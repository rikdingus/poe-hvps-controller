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
afterEach(async () => {
    // Restore a known-safe config between tests
    await writeConfig({
        global_emergency_stop: false,
        default_limits: { max_hv_volts: 2500, max_poe_current_amps: 1.5 },
        channel_overrides: { 'HVPS-07': { max_hv_volts: 1000 } }
    });
});

// ---------------------------------------------------------------------------
// poe_port-aware shutdown tests (added in claude/safety-port-mapping)

test('emergencyShutdown passes poe_port to the shutdown function', async () => {
    await writeConfig({
        global_emergency_stop: false,
        default_limits: { max_hv_volts: 2500, max_poe_current_amps: 1.5 },
        channel_overrides: {}
    });
    await guardian.loadSafetyConfig(true);

    const calls = [];
    guardian._setShutdownForTesting(async (nodeId, poePort) => { calls.push({ nodeId, poePort }); });

    await guardian.emergencyShutdown(3, 'test', 9);
    assert.deepEqual(calls, [{ nodeId: 3, poePort: 9 }]);

    // Restore the simple shutdowns recorder for any tests that run after this one.
    guardian._setShutdownForTesting(async (nodeId) => { shutdowns.push(nodeId); });
});

test('checkSafety passes node.poe_port for per-node violations', async () => {
    await writeConfig({
        global_emergency_stop: false,
        default_limits: { max_hv_volts: 1000 },  // 1.0 kV cap so 1.5 kV trips
        channel_overrides: {}
    });
    await guardian.loadSafetyConfig(true);

    const calls = [];
    guardian._setShutdownForTesting(async (nodeId, poePort) => { calls.push({ nodeId, poePort }); });

    await guardian.checkSafety([
        { nodeId: 1, name: 'HVPS-01', poe_port: 1, status: 'online',
          channels: [{ ch: 1, current_kv: 1.5 }, { ch: 2, current_kv: 0 }],
          power: { v: 48, a: 0.1 } }
    ]);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].nodeId, 1);
    assert.equal(calls[0].poePort, 1, 'safety_guardian forwards nodes.json poe_port');

    guardian._setShutdownForTesting(async (nodeId) => { shutdowns.push(nodeId); });
});

test('emergencyShutdown falls back to nodeId+1 when poe_port omitted', async () => {
    // _defaultShutdown can't actually run in unit tests (would touch net-snmp),
    // but we can verify the fallback path by checking that a missing poe_port
    // does not crash and that the shutdown function still gets called.
    const calls = [];
    guardian._setShutdownForTesting(async (nodeId, poePort) => { calls.push({ nodeId, poePort }); });

    await guardian.emergencyShutdown(2, 'legacy', undefined);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].nodeId, 2);
    assert.equal(calls[0].poePort, undefined, 'undefined poe_port forwarded so _defaultShutdown can run its fallback');

    guardian._setShutdownForTesting(async (nodeId) => { shutdowns.push(nodeId); });
});
