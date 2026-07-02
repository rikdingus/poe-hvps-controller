import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import mqtt from 'mqtt';
import snmp from 'net-snmp';
import { timingSafeEqual } from 'crypto';
import {
  initLogger,
  logTelemetry,
  initDownsampledLogger,
  logDownsampledSample,
  readDownsampledHistory
} from './telemetry_logger.js';
import {
    checkSafety,
    loadSafetyConfig,
    isGlobalEmergencyStop,
    setGlobalEmergencyStop,
    getLimitsForNode,
    emergencyShutdown,
    fetchWithDigest,
    parseSwosResponse,
    setPoeState,
} from './safety_guardian.js';
import { mapStatusToNode, buildOfflineNode } from './node_mapper.js';
import { synthDemoStatus, synthDemoInfra, synthDemoPoe } from './demo_fixture.js';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// DEMO_MODE: synthesize telemetry instead of doing real fetch/SNMP/MQTT I/O.
// Default is OFF -- the real hardware path is completely unchanged.
const DEMO_MODE = process.env.DEMO_MODE === 'true';

// Initialize Loggers
initLogger();
initDownsampledLogger().catch(e => console.error('[LOGGER] Downsampled Logger init failed:', e));

let downsampledHistory = [];
const loadHistory = async () => {
  try {
    downsampledHistory = await readDownsampledHistory(8640);
    // If starting fresh with no history, add an initial data point
    if (downsampledHistory.length === 0) {
      const rate = 0.0;
      const voltage = 26.0;
      const temp = 22.0;
      await logDownsampledSample(rate, voltage, temp);
      downsampledHistory.push({
        timestamp: new Date().toISOString(),
        rate,
        voltage,
        temp
      });
    }
    console.log(`[LOGGER] Loaded ${downsampledHistory.length} downsampled history data points.`);
  } catch (e) {
    console.error('[LOGGER] Failed to load downsampled history:', e.message);
  }
};
loadHistory();

// Infrastructure Configuration
const MIKROTIK_IP = process.env.MIKROTIK_IP || '192.168.88.1';
const SNMP_COMMUNITY = process.env.SNMP_COMMUNITY || 'public';

// OIDs for MikroTik NetPower 8P / RB5009
const OIDS = {
  voltage: '1.3.6.1.4.1.14988.1.1.3.100.1.3.7201',
  temp:    '1.3.6.1.4.1.14988.1.1.3.11.0',
  cpu:     '1.3.6.1.4.1.14988.1.1.3.14.0'
};

// MQTT Bridge Configuration
const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://localhost:1883';
// DEMO_MODE does all I/O synthetically -- a real broker connection would just
// loop ECONNREFUSED reconnects (~1/s of journald spam) whenever no HA broker
// is running. Use an inert stub instead; publishes become no-ops.
const mqttClient = DEMO_MODE
  ? { publish: () => {}, on: () => {} }
  : mqtt.connect(MQTT_BROKER);

if (DEMO_MODE) {
  console.log('[MQTT] DEMO_MODE -- broker connection disabled, publishes are no-ops');
  console.warn('[GUARDIAN] DEMO_MODE -- PoE cut path is MOCKED (virtual ports only, NO hardware writes). Never run production with DEMO_MODE=true.');
}

mqttClient.on('connect', () => {
  console.log(`Connected to Home Assistant MQTT Broker at ${MQTT_BROKER}`);
});

// Log MQTT failures without crashing the proxy. The HA bridge is optional;
// detector telemetry and the safety guardian must keep running even if the
// broker is unreachable.
mqttClient.on('error', (err) => {
  console.warn(`[MQTT] error: ${err && err.message ? err.message : err}`);
});
mqttClient.on('reconnect', () => {
  console.log('[MQTT] reconnecting...');
});

app.use(cors());
app.use(express.json());

// --- Bearer-token auth for write endpoints --------------------------------
// Read-only telemetry (/api/detectors, /api/digitizer, /api/infra,
// /api/credits, /api/safety-status) is open so the frontend can poll
// without ceremony. Anything that MUTATES state -- emergency stop, port
// reboot -- must carry `Authorization: Bearer <DASHBOARD_API_TOKEN>`.
//
// Fail-safe: if DASHBOARD_API_TOKEN is unset OR shorter than 16 chars,
// EVERY write request returns 503. We never accidentally serve writes
// to an unauthenticated client just because someone forgot to set the
// env var.
const DASHBOARD_API_TOKEN = process.env.DASHBOARD_API_TOKEN || '';

if (!DASHBOARD_API_TOKEN || DASHBOARD_API_TOKEN.length < 16) {
  console.warn(`[AUTH] DASHBOARD_API_TOKEN unset or too short (<16 chars). Write endpoints DISABLED.`);
} else {
  console.log(`[AUTH] Write endpoints protected by bearer token (length=${DASHBOARD_API_TOKEN.length}).`);
}

// Timing-safe string compare so attackers can't infer the token byte-by-byte
// from response timing.
function _safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function requireBearer(req, res, next) {
  if (!DASHBOARD_API_TOKEN || DASHBOARD_API_TOKEN.length < 16) {
    return res.status(503).json({ error: 'write endpoints disabled; DASHBOARD_API_TOKEN not configured' });
  }
  const header = req.get('authorization') || '';
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (!m) return res.status(401).json({ error: 'missing or malformed Authorization header' });
  if (!_safeCompare(m[1], DASHBOARD_API_TOKEN)) {
    return res.status(403).json({ error: 'invalid bearer token' });
  }
  next();
}


// Paths to configurations
const NODES_CONFIG   = process.env.NODES_CONFIG || (DEMO_MODE ? '../config/nodes.demo.json' : '../config/nodes.json');
const CREDITS_CONFIG = '../config/ai_credits.json';

let nodeCache      = {};
let infraCache     = { voltage: 0, temp: 0, cpu: 0, lastSeen: null, error: null };
let poeCache       = {};  // per-port PoE telemetry from MikroTik
let digitizerCache = {
  triggerRate: 0,
  coincidenceMode: '2-fold',
  activeChannels: 4,
  lastEvent: null
};

// SNMP Session with Auto-Retry (used for infra polling only)
let session;
const createSnmpSession = () => {
  if (session) session.close();
  session = snmp.createSession(MIKROTIK_IP, SNMP_COMMUNITY, {
    retries: 3,
    timeout: 2000,
    backoff: 1.5
  });
};
createSnmpSession();

const pollInfra = () => {
  if (DEMO_MODE) {
    infraCache = synthDemoInfra();
    mqttClient.publish('korstmos/infra/health', JSON.stringify(infraCache), { retain: true });
    return;
  }
  session.get(Object.values(OIDS), (error, varbinds) => {
    if (!error) {
      infraCache = {
        voltage: varbinds[0].value / 10,
        temp:    varbinds[1].value / 10,
        cpu:     varbinds[2].value,
        lastSeen: new Date(),
        error: null
      };
      infraCache.voltage = isNaN(infraCache.voltage) ? 0 : infraCache.voltage;
      mqttClient.publish('korstmos/infra/health', JSON.stringify(infraCache), { retain: true });
    } else {
      const msg = (error && error.message) || String(error);
      console.warn(`[SNMP] Error polling ${MIKROTIK_IP}:`, msg);
      infraCache.error = msg;
      if (msg.includes('Timeout')) createSnmpSession();
    }
  });
};

// MikroTik per-port PoE OID base (append .<port_index>)
const POE_OID_VOLTAGE = '1.3.6.1.4.1.14988.1.1.15.1.1.4';  // decivolts
const POE_OID_CURRENT = '1.3.6.1.4.1.14988.1.1.15.1.1.5';  // milliamps
const POE_OID_POWER   = '1.3.6.1.4.1.14988.1.1.15.1.1.6';  // deciwatts

const pollPoePorts = async () => {
  try {
    const rawNodes = await fs.readFile(NODES_CONFIG, 'utf-8');
    const nodes = JSON.parse(rawNodes);
    const ports = [...new Set(nodes.map(n => n.poe_port).filter(Boolean))];
    if (ports.length === 0) return;

    if (DEMO_MODE) {
      poeCache = synthDemoPoe(ports);
      return;
    }

    if (process.env.POE_CONTROL_METHOD === 'swos-http') {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        let res;
        try {
          res = await fetchWithDigest(`http://${MIKROTIK_IP}/poe.b`, { signal: controller.signal });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!res.ok) {
          console.warn(`[SwOS POE] HTTP error polling PoE: ${res.status}`);
          poeCache = {};
          return;
        }
        const text = await res.text();
        const data = parseSwosResponse(text);
        
        const voltArray = data.volt || data.i06;
        const currArray = data.curr || data.i05;
        const pwrArray = data.pwr || data.i07;
        
        if (voltArray && currArray && pwrArray) {
          const newPoe = {};
          for (const port of ports) {
            const idx = port - 1;
            if (idx >= 0 && idx < voltArray.length) {
              newPoe[port] = {
                voltage: (Number(voltArray[idx]) || 0) / 10,   // decivolts → V
                current: (Number(currArray[idx]) || 0),          // milliamps
                power:   (Number(pwrArray[idx]) || 0) / 10       // deciwatts → W
              };
            }
          }
          poeCache = newPoe;
        } else {
          console.warn(`[SwOS POE] Expected telemetry arrays not found in SwOS response`);
          poeCache = {};
        }
      } catch (e) {
        console.warn(`[SwOS POE] Error polling ${MIKROTIK_IP}:`, e.message);
        poeCache = {};
      }
    } else {
      const oids = [];
      for (const port of ports) {
        oids.push(`${POE_OID_VOLTAGE}.${port}`);
        oids.push(`${POE_OID_CURRENT}.${port}`);
        oids.push(`${POE_OID_POWER}.${port}`);
      }

      session.get(oids, (error, varbinds) => {
        if (error) {
          console.warn(`[SNMP POE] Error polling ${oids}:`, error.message);
          poeCache = {};
          return;
        }
        const newPoe = {};
        for (let i = 0; i < ports.length; i++) {
          const v = varbinds[i * 3];
          const a = varbinds[i * 3 + 1];
          const w = varbinds[i * 3 + 2];
          newPoe[ports[i]] = {
            voltage: (Number(v?.value) || 0) / 10,   // decivolts → V
            current: (Number(a?.value) || 0),          // milliamps
            power:   (Number(w?.value) || 0) / 10      // deciwatts → W
          };
        }
        poeCache = newPoe;
      });
    }
  } catch (_) { /* nodes.json read failure — ignore, next cycle will retry */ }
};

// Aggregator Loop (Korstmos Detectors)
const pollDetectors = async () => {
  try {
    const rawNodes = await fs.readFile(NODES_CONFIG, 'utf-8');
    const nodes    = JSON.parse(rawNodes);
    const newCache = {};

    // Make sure safety limits are loaded before mapping
    await loadSafetyConfig().catch(() => {});

    for (const node of nodes) {
      let mapped;
      try {
        let rawStatus;

        if (DEMO_MODE) {
          rawStatus = synthDemoStatus(node);
          if (!rawStatus) {
            mapped = buildOfflineNode(node, 'offline', 'PoE power cut');
          }
        } else {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1500);

          const res = await fetch(`http://${node.ip}/status`, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (res.ok) {
            rawStatus = await res.json();
          } else {
            mapped = buildOfflineNode(node, 'error', `HTTP ${res.status}`);
          }
        }

        if (!mapped) {
          // BUG FIX: use node.name ('HVPS-01' etc.) for safety limit lookup
          const limits = getLimitsForNode(node.name) || {};
          mapped = mapStatusToNode(rawStatus, node, limits);
          mqttClient.publish(`korstmos/detector/${node.id}/telemetry`, JSON.stringify(mapped), { retain: true });
        }
      } catch (e) {
        const reason = (e && e.name === 'AbortError') ? 'timeout' : (e && e.message) || 'unknown';
        mapped = buildOfflineNode(node, 'offline', reason);
      }
      newCache[node.id] = mapped;
    }

    // Inject per-port PoE telemetry from MikroTik into each node
    for (const node of nodes) {
      const cached = newCache[node.id];
      if (cached && node.poe_port && poeCache[node.poe_port]) {
        const poe = poeCache[node.poe_port];
        cached.power.poe_v = poe.voltage;
        cached.power.poe_ma = poe.current;
        cached.power.poe_w = poe.power;
      }
    }
    nodeCache = newCache;

    // Simulate Digitizer Muon Logic
    digitizerCache = {
      ...digitizerCache,
      triggerRate: (Math.random() * 8 + 1).toFixed(2),
      lastEvent: new Date().toISOString()
    };

    // Both are async
    logTelemetry(Object.values(nodeCache), infraCache)
      .catch(e => console.error('[LOGGER]', e.message));
    checkSafety(Object.values(nodeCache))
      .catch(e => console.error('[GUARDIAN] checkSafety failed:', e.message));

  } catch (err) {
    console.error('Korstmos Polling Error:', err);
  }
};

setInterval(pollDetectors, 2000);
setInterval(pollInfra,     5000);
setInterval(pollPoePorts,  5000);  // per-port PoE telemetry from switch

// 5-minute downsample interval for telemetry history
setInterval(async () => {
  try {
    const rate = parseFloat(digitizerCache.triggerRate) || 0;
    const voltage = infraCache.voltage || 0;
    const temp = infraCache.temp || 0;
    await logDownsampledSample(rate, voltage, temp);
    downsampledHistory.push({
      timestamp: new Date().toISOString(),
      rate,
      voltage,
      temp
    });
    if (downsampledHistory.length > 8640) {
      downsampledHistory.shift();
    }
  } catch (e) {
    console.error('[LOGGER] Error logging downsampled sample:', e);
  }
}, 5 * 60 * 1000);

// ---- Detector / digitizer / infra endpoints -------------------------
app.get('/api/detectors', (req, res) => res.json(Object.values(nodeCache)));
app.get('/api/digitizer',  (req, res) => res.json(digitizerCache));
app.get('/api/infra',      (req, res) => res.json(infraCache));
app.get('/api/history',    (req, res) => res.json(downsampledHistory));

// PoE off duration during a reboot cycle. ~3s lets ESP32 fully power down
// and bleed off rail capacitance. Configurable for fast-iteration test rigs.
const POE_REBOOT_OFF_MS = Number(process.env.POE_REBOOT_OFF_MS || 3000);

// Auto-on retry policy. Off failures fail-fast (operator can retry); on
// failures retry with backoff because leaving the port off after a successful
// off-set means the detector is unreachable until intervention.
const POE_ON_RETRY_DELAYS_MS = [200, 500, 1500];

async function setPoeWithRetry(port, state, delays) {
  let lastErr;
  for (let i = 0; i <= delays.length; i++) {
    try {
      await setPoeState(port, state);
      return { ok: true, attempts: i + 1 };
    } catch (e) {
      lastErr = e;
      if (i < delays.length) {
        console.warn(`[KORSTMOS] setPoeState(port=${port}, state=${state}) attempt ${i + 1} failed: ${e.message}; retrying in ${delays[i]}ms`);
        await new Promise(r => setTimeout(r, delays[i]));
      }
    }
  }
  return { ok: false, attempts: delays.length + 1, error: lastErr };
}

app.post('/api/reboot-detector/:id', requireBearer, async (req, res) => {
  const nodeId = Number(req.params.id);
  if (!Number.isFinite(nodeId)) return res.status(400).json({ error: 'invalid id' });

  let nodes;
  try {
    nodes = JSON.parse(await fs.readFile(NODES_CONFIG, 'utf-8'));
  } catch (e) {
    return res.status(500).json({ error: `cannot read nodes config: ${e.message}` });
  }

  const target = nodes.find(n => n.id === nodeId);
  if (!target) return res.status(404).json({ error: 'unknown detector id' });
  if (!target.poe_port) return res.status(409).json({ error: 'detector has no poe_port mapping in nodes.json' });

  const result = { nodeId, poe_port: target.poe_port, off_set: false, on_set: false, attempts: { on: 0 } };

  console.log(`[KORSTMOS] Power cycling Detector ${nodeId} on port ${target.poe_port}`);

  // Step 1: off. Fail-fast -- if we can't even cut power, don't pretend.
  try {
    await setPoeState(target.poe_port, 0); // 0 = off
    result.off_set = true;
  } catch (e) {
    console.error(`[KORSTMOS] reboot off-step failed for node ${nodeId}: ${e.message}`);
    return res.status(502).json({ ...result, status: 'failed', step: 'off', error: e.message });
  }

  // Step 2: settle delay.
  await new Promise(r => setTimeout(r, POE_REBOOT_OFF_MS));

  // Step 3: auto-on, with retries. Critical to bring back online.
  const onRes = await setPoeWithRetry(target.poe_port, 1, POE_ON_RETRY_DELAYS_MS);
  result.attempts.on = onRes.attempts;
  if (onRes.ok) {
    result.on_set = true;
    return res.json({ ...result, status: 'success' });
  }

  // Off worked, on didn't even after retries. Port is OFF -- operator needs
  // to manually re-enable. Surface this clearly so the dashboard can show
  // a 'port stuck off' alert rather than 'reboot failed'.
  console.error(`[KORSTMOS] reboot on-step failed for node ${nodeId} after ${onRes.attempts} attempts: ${onRes.error.message}; PORT IS NOW OFF`);
  return res.status(502).json({
    ...result,
    status: 'partial',
    step: 'on',
    error: onRes.error.message,
    note: 'PoE port was successfully cut but auto-on failed after retries; port is currently OFF'
  });
});

app.get('/api/credits', async (req, res) => {
  const data = await fs.readFile(CREDITS_CONFIG, 'utf-8');
  res.json(JSON.parse(data));
});

// ---- Safety endpoints -----------------------------------------------
app.get('/api/safety-status', async (req, res) => {
  try {
    const config = await loadSafetyConfig();
    const rawNodes = await fs.readFile(NODES_CONFIG, 'utf-8');
    const nodes = JSON.parse(rawNodes);
    const limits = nodes.map(n => ({ name: n.name, ...getLimitsForNode(n.name) }));
    res.json({
      global_emergency_stop: isGlobalEmergencyStop(),
      limits,
      default_limits: config.default_limits,
      channel_overrides: config.channel_overrides
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/safety-limits', requireBearer, async (req, res) => {
  try {
    const { default_limits, channel_overrides } = req.body;
    if (!default_limits || !channel_overrides) {
      return res.status(400).json({ error: 'Missing default_limits or channel_overrides' });
    }
    const safetyConfigPath = path.join(path.resolve(), '../config/safety_limits.json');
    
    // Read current config to preserve global_emergency_stop
    const currentRaw = await fs.readFile(safetyConfigPath, 'utf-8');
    const currentConfig = JSON.parse(currentRaw);
    
    const newConfig = {
      global_emergency_stop: currentConfig.global_emergency_stop,
      default_limits,
      channel_overrides
    };
    
    await fs.writeFile(safetyConfigPath, JSON.stringify(newConfig, null, 2));
    await loadSafetyConfig(); // reload into memory
    res.json({ success: true, config: newConfig });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/emergency-stop', requireBearer, async (req, res) => {
  try {
    const active  = !!(req.body && req.body.active);
    const reason  = (req.body && req.body.reason) || `api:${req.ip || 'unknown'}`;
    await setGlobalEmergencyStop(active, reason);
    let shutdowns = [];
    if (active) {
      const online = Object.values(nodeCache).filter(n => n.status === 'online');
      shutdowns = await Promise.all(online.map(n => emergencyShutdown(n.nodeId, `api e-stop: ${reason}`)));
    }
    res.json({ global_emergency_stop: active, reason, shutdowns });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- Static / SPA ---------------------------------------------------
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, 'dist')));
// Wildcard route removed for Express 5 compatibility (preview mode)

app.listen(PORT, () => {
  console.log(`Project Korstmos Master Controller running on port ${PORT}`);
  pollDetectors();
  pollInfra();
});
