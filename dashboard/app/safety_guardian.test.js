// Unit tests for safety_guardian.js
// Run with: node --test dashboard/app/safety_guardian.test.js
//
// We point SAFETY_CONFIG at a temp file BEFORE importing the module so the
// import-time `loadSafetyConfig()` reads our fixture. Each test rewrites the
// file as needed, then forces a reload via loadSafetyConfig(true).

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// Set up a fresh temp config file BEFORE importing the module under test.
const TMP = await fs.mkdtemp(path.join(os.tmpdir(), 'guardian-'));
const CFG = path.join(TMP, 'safety_limits.json');
process.env.SAFETY_CONFIG = CFG;

async function writeConfig(obj) {
    await fs.writeFile(CFG, JSON.stringify(obj, null, 2) + '\n');
    // Bump mtime by a clear amount so the loader sees the change even on coarse FS.
    const future = new Date(Date.now() + 50);
    await fs.utimes(CFG, future, future);
}

await writeConfig({
    global_emergency_stop: false,
    default_limits: { max_hv_volts: 2500, max_poe_current_amps: 1.5, max_temp_c: 65 },
    channel_overrides: { 'HVPS-07': { max_hv_volts: 1000, note: 'sensitive' } }
});

// Now import the module -- its eager loadSafetyConfig() will read our fixture.
const guardian = await import('./safety_guardian.js');

// Capture every shutdown call instead of touching SNMP.
let shutdowns = [];
guardian._setShutdownForTesting(async (nodeId) => { shutdowns.push(nodeId); });

beforeEach(() => { shutdowns = []; });

// ---------------------------------------------------------------------------
test('loadSafetyConfig reads JSON and merges defaults + per-node overrides', async () => {
    await guardian.loadSafetyConfig(true);
    const def = guardian.getLimitsForNode('HVPS-01');
    assert.equal(def.max_hv_volts, 2500);
    assert.equal(def.max_poe_current_amps, 1.5);

    const override = guardian.getLimitsForNode('HVPS-07');
    assert.equal(override.max_hv_volts, 1000, 'override should win over default');
    assert.equal(override.max_poe_current_amps, 1.5, 'unmentioned keys should fall through to default');
    assert.equal(override.note, 'sensitive');
});

// ---------------------------------------------------------------------------
test('checkSafety triggers shutdown when a channel exceeds the per-node limit', async () => {
    await guardian.loadSafetyConfig(true);
    const nodes = [
        { nodeId: 7, name: 'HVPS-07', status: 'online',
          channels: [{ ch: 1, current_kv: 1.05 }],   // > 1.0kV override
          power: { a: 0.1 } }
    ];
    const { violations } = await guardian.checkSafety(nodes);
    assert.equal(violations.length, 1);
    assert.equal(violations[0].kind, 'overvoltage');
    assert.deepEqual(shutdowns, [7]);
});

// ---------------------------------------------------------------------------
test('checkSafety does NOT trigger when channel is within the per-node limit', async () => {
    await guardian.loadSafetyConfig(true);
    const nodes = [
        { nodeId: 7, name: 'HVPS-07', status: 'online',
          channels: [{ ch: 1, current_kv: 0.9 }],   // 0.9kV < 1.0kV override
          power: { a: 0.1 } }
    ];
    const { violations } = await guardian.checkSafety(nodes);
    assert.equal(violations.length, 0);
    assert.deepEqual(shutdowns, []);
});

// ---------------------------------------------------------------------------
test('checkSafety triggers on overcurrent', async () => {
    await guardian.loadSafetyConfig(true);
    const nodes = [
        { nodeId: 1, name: 'HVPS-01', status: 'online',
          channels: [{ ch: 1, current_kv: 0.5 }],
          power: { a: 1.6 } }   // > 1.5A default
    ];
    const { violations } = await guardian.checkSafety(nodes);
    assert.equal(violations.length, 1);
    assert.equal(violations[0].kind, 'overcurrent');
    assert.deepEqual(shutdowns, [1]);
});

// ---------------------------------------------------------------------------
test('checkSafety tolerates offline / malformed nodes without crashing', async () => {
    await guardian.loadSafetyConfig(true);
    const nodes = [
        null,
        undefined,
        { nodeId: 99, name: 'HVPS-99', status: 'offline' },        // no channels
        { nodeId: 1,  name: 'HVPS-01', status: 'online',
          channels: [{ ch: 1, current_kv: NaN }],
          power: { a: NaN } },
        { nodeId: 2,  name: 'HVPS-02' /* no status, no channels */ }
    ];
    const { violations } = await guardian.checkSafety(nodes);
    assert.equal(violations.length, 0, 'NaN/missing readings should never trigger shutdown');
    assert.deepEqual(shutdowns, []);
});

// ---------------------------------------------------------------------------
test('global_emergency_stop=true shuts down every online node, ignores limits', async () => {
    await writeConfig({
        global_emergency_stop: true,
        default_limits: { max_hv_volts: 2500, max_poe_current_amps: 1.5 },
        channel_overrides: {}
    });
    await guardian.loadSafetyConfig(true);
    assert.equal(guardian.isGlobalEmergencyStop(), true);

    const nodes = [
        { nodeId: 1, name: 'HVPS-01', status: 'online', channels: [{ ch: 1, current_kv: 0.1 }], power: { a: 0.1 } },
        { nodeId: 2, name: 'HVPS-02', status: 'online', channels: [{ ch: 1, current_kv: 0.1 }], power: { a: 0.1 } },
        { nodeId: 3, name: 'HVPS-03', status: 'offline' }
    ];
    const { violations } = await guardian.checkSafety(nodes);
    assert.equal(violations.length, 2, 'only the 2 online nodes should be in violations');
    assert.deepEqual(shutdowns.sort(), [1, 2], 'offline node 3 should NOT be shut down');
});

// ---------------------------------------------------------------------------
test('setGlobalEmergencyStop persists to disk and round-trips', async () => {
    // Reset to a known good config first.
    await writeConfig({
        global_emergency_stop: false,
        default_limits: { max_hv_volts: 2500, max_poe_current_amps: 1.5 },
        channel_overrides: {}
    });
    await guardian.loadSafetyConfig(true);
    assert.equal(guardian.isGlobalEmergencyStop(), false);

    await guardian.setGlobalEmergencyStop(true, 'unit test');
    assert.equal(guardian.isGlobalEmergencyStop(), true);

    // Verify the file on disk reflects it
    const onDisk = JSON.parse(await fs.readFile(CFG, 'utf-8'));
    assert.equal(onDisk.global_emergency_stop, true);

    // Round-trip clear
    await guardian.setGlobalEmergencyStop(false, 'reset');
    const clearedOnDisk = JSON.parse(await fs.readFile(CFG, 'utf-8'));
    assert.equal(clearedOnDisk.global_emergency_stop, false);
});

// ---------------------------------------------------------------------------
test('hot-reload picks up edits to safety_limits.json', async () => {
    // Start with a permissive config
    await writeConfig({
        global_emergency_stop: false,
        default_limits: { max_hv_volts: 5000, max_poe_current_amps: 5 },
        channel_overrides: {}
    });
    await guardian.loadSafetyConfig(true);
    let nodes = [{ nodeId: 1, name: 'HVPS-01', status: 'online',
                   channels: [{ ch: 1, current_kv: 2.5 }], power: { a: 0.1 } }];
    let { violations } = await guardian.checkSafety(nodes);
    assert.equal(violations.length, 0, '2.5kV is fine under the 5kV limit');

    // Tighten the limit on disk -- next checkSafety should pick it up via mtime hot-reload.
    await writeConfig({
        global_emergency_stop: false,
        default_limits: { max_hv_volts: 1000, max_poe_current_amps: 5 },
        channel_overrides: {}
    });
    ({ violations } = await guardian.checkSafety(nodes));
    assert.equal(violations.length, 1, '2.5kV should now trip the 1.0kV limit');
    assert.equal(violations[0].kind, 'overvoltage');
});

// ---------------------------------------------------------------------------
test('parseSwosResponse parses various formats of SwOS responses', () => {
    const r1 = '{poe:[0x02,0x02,0x00],volt:[240,240,0]}';
    const parsed1 = guardian.parseSwosResponse(r1);
    assert.deepEqual(parsed1, { poe: [2, 2, 0], volt: [240, 240, 0] });

    const r2 = '{"i01":[2,1],"i06":[238,239]}';
    const parsed2 = guardian.parseSwosResponse(r2);
    assert.deepEqual(parsed2, { i01: [2, 1], i06: [238, 239] });
});

// ---------------------------------------------------------------------------
test('getPoePortForNode resolves poe_port from nodes.json config', async () => {
    const nodesJson = path.join(TMP, 'nodes.json');
    process.env.NODES_CONFIG = nodesJson;
    await fs.writeFile(nodesJson, JSON.stringify([
        { id: 1, name: 'HVPS-01', poe_port: 8 },
        { id: 2, name: 'HVPS-02' }
    ]) + '\n');

    const port1 = await guardian.getPoePortForNode(1);
    assert.equal(port1, 8, 'should read poe_port from nodes.json');

    const port2 = await guardian.getPoePortForNode(2);
    assert.equal(port2, 3, 'should fallback to nodeId + 1 if poe_port is missing');
});

// ---------------------------------------------------------------------------
test('fetchWithDigest executes HTTP Digest authentication handshake and parses response', async () => {
    const http = await import('http');
    let requests = [];
    const server = http.createServer((req, res) => {
        requests.push({
            method: req.method,
            url: req.url,
            headers: req.headers
        });
        
        const auth = req.headers.authorization;
        if (!auth) {
            res.writeHead(401, {
                'WWW-Authenticate': 'Digest realm="MikroTik", nonce="mocknonce123", qop="auth"'
            });
            res.end('Unauthorized');
        } else {
            if (auth.includes('username="admin"') && auth.includes('nonce="mocknonce123"')) {
                res.writeHead(200, { 'Content-Type': 'application/x-javascript' });
                res.end('{poe:[0x02,0x02,0x02,0x02,0x02,0x02,0x02,0x02]}');
            } else {
                res.writeHead(403);
                res.end('Forbidden');
            }
        }
    });

    const port = await new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve(server.address().port));
    });

    try {
        process.env.MIKROTIK_IP = `127.0.0.1:${port}`;
        process.env.MIKROTIK_USERNAME = 'admin';
        process.env.MIKROTIK_PASSWORD = 'password';

        const res = await guardian.fetchWithDigest(`http://127.0.0.1:${port}/poe.b`);
        assert.equal(res.status, 200);
        const text = await res.text();
        const data = guardian.parseSwosResponse(text);
        assert.deepEqual(data.poe, [2, 2, 2, 2, 2, 2, 2, 2]);

        assert.equal(requests.length, 2);
        assert.equal(requests[0].headers.authorization, undefined);
        assert.ok(requests[1].headers.authorization.includes('username="admin"'));
    } finally {
        server.close();
    }
});

// ---------------------------------------------------------------------------
test('swos-http PoE shutdown updates port to 0 and posts to switch', async () => {
    const http = await import('http');
    let requests = [];
    const server = http.createServer((req, res) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            requests.push({
                method: req.method,
                url: req.url,
                headers: req.headers,
                body
            });
            
            const auth = req.headers.authorization;
            if (!auth) {
                res.writeHead(401, {
                    'WWW-Authenticate': 'Digest realm="MikroTik", nonce="mocknonce123", qop="auth"'
                });
                res.end('Unauthorized');
                return;
            }
            
            if (req.method === 'GET') {
                res.writeHead(200, { 'Content-Type': 'application/x-javascript' });
                res.end('{poe:[0x02,0x02,0x02,0x02,0x02,0x02,0x02,0x02]}');
            } else if (req.method === 'POST') {
                res.writeHead(200);
                res.end('OK');
            }
        });
    });

    const port = await new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve(server.address().port));
    });

    try {
        process.env.MIKROTIK_IP = `127.0.0.1:${port}`;
        process.env.POE_CONTROL_METHOD = 'swos-http';
        process.env.NODES_CONFIG = path.join(TMP, 'nodes.json');
        await fs.writeFile(process.env.NODES_CONFIG, JSON.stringify([
            { id: 1, name: 'HVPS-01', poe_port: 3 }
        ]) + '\n');

        guardian._setShutdownForTesting(null);

        const shutdownResult = await guardian.emergencyShutdown(1, 'test overvoltage');
        assert.equal(shutdownResult.ok, true);

        const postReq = requests.find(r => r.method === 'POST');
        assert.ok(postReq);
        const parsedBody = JSON.parse(postReq.body);
        assert.deepEqual(parsedBody.poe, [2, 2, 0, 2, 2, 2, 2, 2]);

    } finally {
        server.close();
        guardian._setShutdownForTesting(async (nodeId) => { shutdowns.push(nodeId); });
    }
});

// ---------------------------------------------------------------------------
afterEach(async () => {
    // Restore a known-safe config between tests
    await writeConfig({
        global_emergency_stop: false,
        default_limits: { max_hv_volts: 2500, max_poe_current_amps: 1.5 },
        channel_overrides: { 'HVPS-07': { max_hv_volts: 1000 } }
    });
});
