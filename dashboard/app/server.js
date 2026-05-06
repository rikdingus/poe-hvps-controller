import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import mqtt from 'mqtt';
import snmp from 'net-snmp';
import { initLogger, logTelemetry } from './telemetry_logger.js';
import {
    checkSafety,
    loadSafetyConfig,
    isGlobalEmergencyStop,
    setGlobalEmergencyStop,
    getLimitsForNode,
    emergencyShutdown,
} from './safety_guardian.js';

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

    for (const node of nodes) {
      try {
        const controller = new AbortController();
        const timeoutId  = setTimeout(() => controller.abort(), 1500);

        const res = await fetch(`http://${node.ip}/status`, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const rawStatus = await res.json();
          newCache[node.id] = {
            nodeId: node.id,
            // BUG FIX: use node.name from nodes.json ('HVPS-01' etc.) so that
            // getLimitsForNode() can match channel_overrides in safety_limits.json.
            // Previously this was `Detector-${padded}` which never matched any override.
            name: node.name,
            status: 'online',
            channels: [
              {
                ch: 1,
                target_kv: rawStatus.p1 / 1000,
                current_kv: (rawStatus.hv1 * (rawStatus.hv1g ?? 1) + (rawStatus.hv1o ?? 0)) / 1000,
                limit_kv: 3.0
              }
            ],
            power:   { v: rawStatus.v, a: rawStatus.i, w: rawStatus.v * rawStatus.i },
            ups:     { battery_pct: rawStatus.batt || 100, source: rawStatus.v > 30 ? 'dc' : 'battery' },
            lastSeen: new Date()
          };
          mqttClient.publish(
            `korstmos/detector/${node.id}/telemetry`,
            JSON.stringify(newCache[node.id]),
            { retain: true }
          );
        } else {
          newCache[node.id] = { ...node, status: 'error', lastSeen: new Date() };
        }
      } catch (e) {
        newCache[node.id] = { ...node, status: 'offline', lastSeen: new Date() };
      }
    }
    nodeCache = newCache;

    // Simulate Digitizer Muon Logic
    digitizerCache = {
      ...digitizerCache,
      triggerRate: (Math.random() * 8 + 1).toFixed(2),
      lastEvent: new Date().toISOString()
    };

    // Both are async — always catch so a single failure never kills the polling loop.
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

app.post('/api/reboot-detector/:id', async (req, res) => {
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
// GET /api/safety-status -> current global flag + per-node effective limits
app.get('/api/safety-status', async (req, res) => {
  try {
    await loadSafetyConfig();
    const nodes  = JSON.parse(await fs.readFile(NODES_CONFIG, 'utf-8'));
    const limits = nodes.map(n => ({ name: n.name, ...getLimitsForNode(n.name) }));
    res.json({ global_emergency_stop: isGlobalEmergencyStop(), limits });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/emergency-stop  body: { active: true|false, reason?: string }
// Persists global_emergency_stop in safety_limits.json. If activating, also
// triggers immediate shutdown of every currently-online detector.
app.post('/api/emergency-stop', async (req, res) => {
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
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => {
  console.log(`Project Korstmos Master Controller running on port ${PORT}`);
  pollDetectors();
  pollInfra();
});
