// =====================================================================
//  demo_fixture.js -- Project Korstmos
//
//  Pure, side-effect-free generators for DEMO_MODE (see server.js).
//  Used ONLY when process.env.DEMO_MODE === 'true'; the real fetch/SNMP/
//  MQTT path in server.js is untouched and these functions are never
//  imported into that code path otherwise.
//
//  Output shapes deliberately mirror what node_mapper.mapStatusToNode()
//  expects as firmware /status input (synthDemoStatus), and what
//  pollInfra/pollPoePorts build for infraCache/poeCache -- see server.js.
//
//  Does NOT touch safety_guardian.js or safety_limits.json. HVPS-07 is
//  synthesized to sit just above its existing 1000V channel_overrides
//  limit (dashboard/config/safety_limits.json) purely as telemetry, so
//  the existing safety UI/logic renders a real violation state without
//  any change to the cut logic itself -- see safety-cut-path-proposal.md
//  for that separate (already-drafted) effort.
// =====================================================================

// Must match the channel_overrides key in dashboard/config/safety_limits.json
const OVERRIDE_NODE_NAME = 'HVPS-07';

/**
 * Synthesize a firmware-shaped /status response for one node. Feed this
 * straight into node_mapper.mapStatusToNode(rawStatus, node, limits) exactly
 * like the real fetch path does -- this function does NOT build the
 * canonical Node shape itself, so there's only one place (node_mapper.js)
 * that shape can drift from.
 *
 * @param {object} nodeConfig one entry from nodes.demo.json
 */
export function synthDemoStatus(nodeConfig) {
  const t = Date.now() / 1000;
  const phase = (nodeConfig.id || 0) * 0.7;

  let hv1, hv2;
  if (nodeConfig.name === OVERRIDE_NODE_NAME) {
    // Deliberately sits just above the 1000V (1.0kV) override so the
    // safety panel / channel limit_kv comparison renders a live violation
    // for the whole demo, not an intermittent flicker.
    hv1 = 1.03 + 0.02 * Math.sin(t / 15) + (Math.random() - 0.5) * 0.005;
    hv2 = 0.40 + 0.03 * Math.sin(t / 20 + phase) + (Math.random() - 0.5) * 0.01;
  } else {
    const base = 0.45 + 0.15 * Math.sin(t / 20 + phase);
    hv1 = base + (Math.random() - 0.5) * 0.01;
    hv2 = base * 0.82 + (Math.random() - 0.5) * 0.01;
  }

  const p1 = Math.round(100 + 40 * Math.sin(t / 20 + phase));
  const p2 = Math.round(90 + 35 * Math.sin(t / 22 + phase + 1));

  return {
    v: Number((48 + 0.3 * Math.sin(t / 30 + phase) + (Math.random() - 0.5) * 0.1).toFixed(2)),
    i: Number((0.18 + 0.08 * Math.sin(t / 25 + phase) + (Math.random() - 0.5) * 0.01).toFixed(3)),
    hv1: Number(hv1.toFixed(4)),
    hv2: Number(hv2.toFixed(4)),
    p1,
    p2,
    c1: p1 + Math.round((Math.random() - 0.5) * 2),
    c2: p2 + Math.round((Math.random() - 0.5) * 2),
    batt: Math.round(90 + 8 * Math.sin(t / 60 + phase)),
    ok: true
  };
}

/** Synthesize infraCache (facility bus voltage / lab temp / cpu). */
export function synthDemoInfra() {
  const t = Date.now() / 1000;
  return {
    voltage: Number((26 + 1.5 * Math.sin(t / 30) + (Math.random() - 0.5) * 0.2).toFixed(1)),
    temp: Number((22 + 2 * Math.sin(t / 45 + 1) + (Math.random() - 0.5) * 0.3).toFixed(1)),
    cpu: Math.max(0, Math.round(15 + 5 * Math.sin(t / 20) + Math.random() * 3)),
    lastSeen: new Date(),
    error: null
  };

}

/** Synthesize poeCache: { [port]: { voltage(V), current(mA), power(W) } } per PoE port,
 *  matching the shape server.js maps into each node's power.poe_v/poe_ma/poe_w. */
export function synthDemoPoe(ports) {
  const t = Date.now() / 1000;
  const out = {};
  for (const port of ports) {
    const phase = port * 0.5;
    const voltage = Number((54 + 0.4 * Math.sin(t / 30 + phase) + (Math.random() - 0.5) * 0.1).toFixed(1));
    const current = Math.round(180 + 50 * Math.sin(t / 25 + phase) + (Math.random() - 0.5) * 6);
    const power = Number((voltage * current / 1000).toFixed(1));
    out[port] = { voltage, current, power };
  }
  return out;
}
