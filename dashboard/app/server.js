import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import mqtt from 'mqtt';
import snmp from 'net-snmp';
import { timingSafeEqual } from 'crypto';
import { initLogger, logTelemetry } from './telemetry_logger.js';
import {
    checkSafety,
    loadSafetyConfig,
    isGlobalEmergencyStop,
    setGlobalEmergencyStop,
    getLimitsForNode,
    emergencyShutdown,
} from './safety_guardian.js';
import { mapStatusToNode, buildOfflineNode } from './node_mapper.js';

const app = express();
const PORT = 3000;

// Initialize Logger
initLogger();

// Infrastructure Configuration
const MIKROTIK_IP = process.env.MIKROTIK_IP || '192.168.88.1';
const SNMP_COMMUNITY = process.env.SNMP_COMMUNITY || 'public';

// OIDs for MikroTik NetPower 8P / RB5009
const OIDS = {
  voltage: '.1.3.6.1.4.1.14988.1.1.3.10.0',
  temp:    '.1.3.6.1.4.1.14988.1.1.3.11.0',
  cpu:     '.1.3.6.1.4.1.14988.1.1.3.14.0'
};

// MQTT Bridge Configuration
const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://localhost:1883';
const mqttClient = mqtt.connect(MQTT_BROKER);

mqttClient.on('connect', () => {
  console.log(`Connected to Home Assistant MQTT Broker at ${MQTT_BROKER}`);
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
const NODES_CONFIG   = process.env.NODES_CONFIG || '../config/nodes.json';
const CREDITS_CONFIG = '../config/ai_credits.json';

let nodeCache      = {};
let infraCache     = { voltage: 0, temp: 0, cpu: 0, lastSeen: null, error: null };
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
      console.warn(`[SNMP] Error polling ${MIKROTIK_IP}:`, error.message);
      infraCache.error = error.message;
      if (error.message.includes('Timeout')) createSnmpSession();
    }
  });
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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);

        const res = await fetch(`http://${node.ip}/status`, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const rawStatus = await res.json();
          // BUG FIX: use node.name ('HVPS-01' etc.) for safety limit lookup
          const limits = getLimitsForNode(node.name) || {};
          mapped = mapStatusToNode(rawStatus, node, limits);
          mqttClient.publish(`korstmos/detector/${node.id}/telemetry`, JSON.stringify(mapped), { retain: true });
        } else {
          mapped = buildOfflineNode(node, 'error', `HTTP ${res.status}`);
        }
      } catch (e) {
        const reason = (e && e.name === 'AbortError') ? 'timeout' : (e && e.message) || 'unknown';
        mapped = buildOfflineNode(node, 'offline', reason);
      }
      newCache[node.id] = mapped;
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

// ---- Detector / digitizer / infra endpoints -------------------------
app.get('/api/detectors', (req, res) => res.json(Object.values(nodeCache)));
app.get('/api/digitizer',  (req, res) => res.json(digitizerCache));
app.get('/api/infra',      (req, res) => res.json(infraCache));

app.post('/api/reboot-detector/:id', requireBearer, async (req, res) => {
  const nodeId = req.params.id;
  const nodes  = JSON.parse(await fs.readFile(NODES_CONFIG, 'utf-8'));
  const target = nodes.find(n => n.id == nodeId);
  if (target && target.poe_port) {
    console.log(`[KORSTMOS] Power cycling Detector ${nodeId} on port ${target.poe_port}`);
    res.json({ status: 'success' });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

app.get('/api/credits', async (req, res) => {
  const data = await fs.readFile(CREDITS_CONFIG, 'utf-8');
  res.json(JSON.parse(data));
});

// ---- Safety endpoints -----------------------------------------------
app.get('/api/safety-status', async (req, res) => {
  try {
    await loadSafetyConfig();
    const rawNodes = await fs.readFile(NODES_CONFIG, 'utf-8');
    const nodes = JSON.parse(rawNodes);
    const limits = nodes.map(n => ({ name: n.name, ...getLimitsForNode(n.name) }));
    res.json({ global_emergency_stop: isGlobalEmergencyStop(), limits });
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
