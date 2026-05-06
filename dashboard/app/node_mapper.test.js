// Unit tests for node_mapper.js
// Run with: node --test dashboard/app/node_mapper.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapStatusToNode, buildOfflineNode } from './node_mapper.js';

const NODE_CFG = { id: 1, name: 'HVPS-01', ip: '192.168.1.221', location: 'Rack A' };
const NODE_CFG_CALIBRATED = { ...NODE_CFG, kv_per_step: 0.01 };  // 0.01 kV per pot step
const LIMITS = { max_hv_volts: 2500, max_poe_current_amps: 1.5 };

// ---------------------------------------------------------------------------
test('mapStatusToNode produces canonical shape with both channels', () => {
    const raw = { v: 48.2, i: 0.12, hv1: 0.625, hv2: 0.275, p1: 127, p2: 200, c1: 127, c2: 199, ok: true };
    const node = mapStatusToNode(raw, NODE_CFG, LIMITS);

    assert.equal(node.nodeId, 1);
    assert.equal(node.name, 'HVPS-01');
    assert.equal(node.status, 'online');
    assert.equal(node.sensor_ok, true);
    assert.equal(node.channels.length, 2, 'must include channel 2 -- previously missing!');

    // Channel 1
    assert.equal(node.channels[0].ch, 1);
    assert.equal(node.channels[0].current_kv, 0.625, 'hv1 reads directly as kV');
    assert.equal(node.channels[0].current_pot, 127);
    assert.equal(node.channels[0].target_pot, 127);
    assert.equal(node.channels[0].target_kv, null, 'no kv_per_step calibration -> target_kv is null');
    assert.equal(node.channels[0].limit_kv, 2.5);

    // Channel 2
    assert.equal(node.channels[1].ch, 2);
    assert.equal(node.channels[1].current_kv, 0.275);
    assert.equal(node.channels[1].current_pot, 199);
    assert.equal(node.channels[1].target_pot, 200);
    assert.equal(node.channels[1].limit_kv, 2.5);

    assert.deepEqual(node.power, { v: 48.2, a: 0.12, w: 48.2 * 0.12 });
    assert.equal(node.ups.source, 'dc', 'PoE rail >30V -> dc source');
    assert.equal(node.error, null);
});

// ---------------------------------------------------------------------------
test('mapStatusToNode does NOT produce NaN from missing hv1g/hv1o (regression)', () => {
    // The previous implementation did `(hv1 * hv1g + hv1o) / 1000` -- the
    // firmware never returns hv1g/hv1o, so current_kv was silently NaN.
    const raw = { v: 48, i: 0.1, hv1: 0.5, hv2: 0.4, p1: 127, p2: 127, c1: 127, c2: 127, ok: true };
    const node = mapStatusToNode(raw, NODE_CFG, LIMITS);
    assert.ok(Number.isFinite(node.channels[0].current_kv), 'current_kv must be finite');
    assert.ok(Number.isFinite(node.channels[1].current_kv), 'channel 2 current_kv must be finite');
    assert.equal(node.channels[0].current_kv, 0.5, '0.5V raw * 1000 gain / 1000 = 0.5 kV');
    assert.equal(node.channels[1].current_kv, 0.4);
});

// ---------------------------------------------------------------------------
test('mapStatusToNode applies dynamic firmware calibration (gain and offset)', () => {
    // Test case: ADC reads 1.0V. Gain is calibrated to 1025V/V. Offset is 50V.
    // kV = (1.0 * 1025 + 50) / 1000 = 1.075 kV
    const raw = { 
        v: 48, i: 0.1, 
        hv1: 1.0,  hv1g: 1025, hv1o: 50,
        hv2: 2.0,  hv2g: 1000, hv2o: -100, // 2kV - 0.1kV = 1.9kV
        p1: 100, p2: 100, c1: 100, c2: 100, ok: true 
    };
    const node = mapStatusToNode(raw, NODE_CFG, LIMITS);
    
    assert.equal(node.channels[0].current_kv, 1.075);
    assert.equal(node.channels[1].current_kv, 1.9);
});

// ---------------------------------------------------------------------------
test('mapStatusToNode applies kv_per_step calibration when nodes.json provides it', () => {
    const raw = { v: 48, i: 0.1, hv1: 0.5, hv2: 0.5, p1: 100, p2: 200, c1: 100, c2: 200, ok: true };
    const node = mapStatusToNode(raw, NODE_CFG_CALIBRATED, LIMITS);
    assert.equal(node.channels[0].target_kv, 1.0, '100 * 0.01 = 1.0 kV');
    assert.equal(node.channels[1].target_kv, 2.0, '200 * 0.01 = 2.0 kV');
});

// ---------------------------------------------------------------------------
test('mapStatusToNode handles battery source heuristic', () => {
    const raw = { v: 12, i: 0.1, hv1: 0, hv2: 0, p1: 0, p2: 0, c1: 0, c2: 0, ok: true };
    const node = mapStatusToNode(raw, NODE_CFG, LIMITS);
    assert.equal(node.ups.source, 'battery', '12V on rail -> battery');
});

// ---------------------------------------------------------------------------
test('mapStatusToNode coerces non-numeric / missing fields to safe defaults', () => {
    const raw = { v: 'NaN', i: undefined, hv1: null, hv2: 'oops', p1: 'x', p2: 'y', c1: 'z', c2: '', ok: false };
    const node = mapStatusToNode(raw, NODE_CFG, LIMITS);
    assert.equal(node.power.v, 0);
    assert.equal(node.power.a, 0);
    assert.equal(node.channels[0].current_kv, 0);
    assert.equal(node.channels[0].target_pot, null);
    assert.equal(node.channels[0].current_pot, null);
    assert.equal(node.sensor_ok, false);
});

// ---------------------------------------------------------------------------
test('mapStatusToNode falls back to error shape on null/non-object input', () => {
    const node = mapStatusToNode(null, NODE_CFG, LIMITS);
    assert.equal(node.status, 'error');
    assert.equal(node.error, 'empty firmware response');
    assert.deepEqual(node.channels, []);
});

// ---------------------------------------------------------------------------
test('limit_kv is null when no safety limits are provided', () => {
    const raw = { v: 48, i: 0.1, hv1: 0.5, hv2: 0.5, p1: 100, p2: 100, c1: 100, c2: 100, ok: true };
    const node = mapStatusToNode(raw, NODE_CFG, {});
    assert.equal(node.channels[0].limit_kv, null);
    assert.equal(node.channels[1].limit_kv, null);
});

// ---------------------------------------------------------------------------
test('buildOfflineNode produces canonical shape with empty channels (no crash downstream)', () => {
    const node = buildOfflineNode(NODE_CFG, 'offline', 'timeout');
    assert.equal(node.nodeId, 1);
    assert.equal(node.name, 'HVPS-01');
    assert.equal(node.status, 'offline');
    assert.deepEqual(node.channels, [], 'empty array, NOT undefined -- safety_guardian relies on Array.isArray');
    assert.deepEqual(node.power, { v: 0, a: 0, w: 0 });
    assert.equal(node.ups.battery_pct, null);
    assert.equal(node.ups.source, 'unknown');
    assert.equal(node.sensor_ok, false);
    assert.equal(node.error, 'timeout');
});

// ---------------------------------------------------------------------------
test('buildOfflineNode survives nodeConfig with no name field', () => {
    const node = buildOfflineNode({ id: 5 }, 'offline', null);
    assert.equal(node.name, 'Detector-05');
    assert.equal(node.error, null);
});

// ---------------------------------------------------------------------------
test('online and offline shapes have IDENTICAL keys (frontend can rely on this)', () => {
    const online  = mapStatusToNode({ v:48,i:0.1,hv1:0.5,hv2:0.4,p1:1,p2:1,c1:1,c2:1,ok:true }, NODE_CFG, LIMITS);
    const offline = buildOfflineNode(NODE_CFG, 'offline', 'timeout');
    assert.deepEqual(Object.keys(online).sort(), Object.keys(offline).sort());
    assert.deepEqual(Object.keys(online.power).sort(), Object.keys(offline.power).sort());
    assert.deepEqual(Object.keys(online.ups).sort(),   Object.keys(offline.ups).sort());
});
