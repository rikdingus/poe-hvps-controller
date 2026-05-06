// =====================================================================
//  safety_guardian.js  -- Project Korstmos
//
//  Loads dashboard/config/safety_limits.json (with hot-reload), enforces
//  per-node limits + a global emergency-stop flag, and cuts PoE power
//  via the MikroTik switch when a violation is detected.
//
//  Design notes:
//    * Fail-SAFE: if safety_limits.json is unreadable on first load, we
//      throw -- the polling loop must not run without limits.
//    * SNMP shutdown is factored into a private function and overridable
//      via _setShutdownForTesting() so unit tests don't touch the network.
//    * checkSafety() is async; the caller (server.js pollDetectors)
//      should `.catch()` it so a guardian error never crashes the loop.
//    * net-snmp is imported lazily so unit tests that mock the shutdown
//      path never need the dependency.
//
//  Public API:
//    loadSafetyConfig(force?)         -> Promise<config>
//    getLimitsForNode(name)           -> { max_hv_volts, max_poe_current_amps, ... }
//    isGlobalEmergencyStop()          -> boolean
//    setGlobalEmergencyStop(v, why?)  -> Promise<boolean>   (persists)
//    emergencyShutdown(nodeId, why?)  -> Promise<{ok,nodeId,reason,error?}>
//    checkSafety(nodeData)            -> Promise<{violations:[]}>
//    _setShutdownForTesting(fn)       -> for tests only
// =====================================================================

import fs from 'fs/promises';
import path from 'path';

const MIKROTIK_IP          = process.env.MIKROTIK_IP          || '192.168.88.1';
const SNMP_COMMUNITY_WRITE = process.env.SNMP_COMMUNITY_WRITE || 'private';
const SAFETY_CONFIG_PATH   = process.env.SAFETY_CONFIG        || path.resolve(process.cwd(), '../config/safety_limits.json');
// MikroTik PoE control OID. Values: 1=auto-on, 2=forced-on, 3=off.
const POE_CONTROL_OID      = '.1.3.6.1.4.1.14988.1.1.15.1.1.2';

let _config        = null;   // cached parsed JSON
let _configMtimeMs = null;   // mtime when last loaded (for hot-reload)
let _snmpModule    = null;   // lazily imported net-snmp module
let _snmpSession   = null;   // SNMP session (reused across calls)
let _shutdownFn    = null;   // injectable for testing

// --- Config loader (hot-reloads on file mtime change) ---------------
export async function loadSafetyConfig(force = false) {
    let stat;
    try {
        stat = await fs.stat(SAFETY_CONFIG_PATH);
    } catch (e) {
        const msg = `[GUARDIAN] safety config not found at ${SAFETY_CONFIG_PATH}: ${e.message}`;
        if (_config) { console.warn(msg, '-- keeping previous config in memory'); return _config; }
        console.error(msg);
        throw new Error('Safety config required and unreadable; refusing to operate.');
    }
    if (!force && _configMtimeMs && stat.mtimeMs === _configMtimeMs) return _config;

    try {
        const raw    = await fs.readFile(SAFETY_CONFIG_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        _config        = parsed;
        _configMtimeMs = stat.mtimeMs;
        console.log(`[GUARDIAN] Loaded safety_limits.json (mtime ${new Date(stat.mtimeMs).toISOString()})`);
        return _config;
    } catch (e) {
        console.error(`[GUARDIAN] safety config parse failure: ${e.message}`);
        if (_config) return _config;
        throw new Error('Safety config malformed; refusing to operate.');
    }
}

// --- Per-node limit lookup (defaults merged with per-node override) --
export function getLimitsForNode(nodeName) {
    if (!_config) throw new Error('Safety config not loaded -- call loadSafetyConfig() first');
    const def      = _config.default_limits      || {};
    const override = (_config.channel_overrides  || {})[nodeName] || {};
    return { ...def, ...override };
}

// --- Global e-stop state -------------------------------------------
export function isGlobalEmergencyStop() {
    return !!(_config && _config.global_emergency_stop);
}

export async function setGlobalEmergencyStop(value, reason = 'manual') {
    if (!_config) await loadSafetyConfig();
    _config.global_emergency_stop = !!value;
    await fs.writeFile(SAFETY_CONFIG_PATH, JSON.stringify(_config, null, 2) + '\n');
    _configMtimeMs = (await fs.stat(SAFETY_CONFIG_PATH)).mtimeMs;
    console.error(`[GUARDIAN] global_emergency_stop set to ${value} (reason: ${reason})`);
    return _config.global_emergency_stop;
}

// --- SNMP-driven PoE shutdown (lazily init, overridable for tests) --
async function _defaultShutdown(nodeId) {
    // Lazy-import net-snmp so that test code that never calls this path
    // doesn't need the native binding.
    if (!_snmpModule) {
        _snmpModule = (await import('net-snmp')).default;
    }
    if (!_snmpSession) {
        _snmpSession = _snmpModule.createSession(MIKROTIK_IP, SNMP_COMMUNITY_WRITE);
    }
    // Mapping: detector node N -> MikroTik PoE port N+1.
    const portIndex = nodeId + 1;
    const oid = `${POE_CONTROL_OID}.${portIndex}`;
    return new Promise((resolve, reject) => {
        _snmpSession.set(
            [{ oid, type: _snmpModule.ObjectType.Integer, value: 3 }],
            (error) => error ? reject(error) : resolve()
        );
    });
}

/** Test hook: pass a function `(nodeId) => Promise<void>` to bypass SNMP. */
export function _setShutdownForTesting(fn) { _shutdownFn = fn; }

export async function emergencyShutdown(nodeId, reason = 'unspecified') {
    console.error(`[GUARDIAN] EMERGENCY SHUTDOWN node=${nodeId} reason="${reason}"`);
    const fn = _shutdownFn || _defaultShutdown;
    try {
        await fn(nodeId);
        console.log(`[GUARDIAN] Power cut OK for node ${nodeId}`);
        return { ok: true, nodeId, reason };
    } catch (e) {
        console.error(`[GUARDIAN] FAILED to cut power node=${nodeId}: ${e.message}`);
        return { ok: false, nodeId, reason, error: e.message };
    }
}

// --- Periodic check called from server polling loop ----------------
export async function checkSafety(nodeData) {
    await loadSafetyConfig();   // hot-reloads if the JSON has changed on disk

    // Global e-stop: shut down ALL online detectors in parallel.
    if (isGlobalEmergencyStop()) {
        const online = (nodeData || []).filter(n => n && n.status === 'online');
        if (online.length > 0) {
            console.warn(`[GUARDIAN] global_emergency_stop active; shutting down ${online.length} detector(s).`);
            await Promise.all(online.map(n => emergencyShutdown(n.nodeId, 'global_emergency_stop')));
        }
        return { violations: online.map(n => ({ nodeId: n.nodeId, reason: 'global_emergency_stop' })) };
    }

    // Per-node check (sequential: shut one node down fully before moving to the next,
    // which avoids flooding the SNMP switch with simultaneous OID writes).
    const violations = [];
    for (const node of (nodeData || [])) {
        // Tolerate offline / malformed nodes -- never crash the polling loop.
        if (!node || node.status !== 'online' || !Array.isArray(node.channels)) continue;

        const limits = getLimitsForNode(node.name);
        const maxKv  = (limits.max_hv_volts != null) ? (limits.max_hv_volts / 1000) : Infinity;

        for (const ch of node.channels) {
            const kv = Number(ch && ch.current_kv);
            if (Number.isFinite(kv) && kv > maxKv) {
                violations.push({ nodeId: node.nodeId, channel: ch.ch, kind: 'overvoltage', kv, maxKv });
                await emergencyShutdown(node.nodeId, `ch${ch.ch} ${kv.toFixed(3)}kV > ${maxKv}kV limit`);
            }
        }

        const a = Number(node.power && node.power.a);
        if (Number.isFinite(a) && limits.max_poe_current_amps != null && a > limits.max_poe_current_amps) {
            violations.push({ nodeId: node.nodeId, kind: 'overcurrent', a, maxA: limits.max_poe_current_amps });
            await emergencyShutdown(node.nodeId, `${a.toFixed(3)}A > ${limits.max_poe_current_amps}A limit`);
        }
    }

    return { violations };
}

// Eager initial load so the first checkSafety call is fast.
// Don't crash on startup -- log and let the first checkSafety() throw if the config is broken.
loadSafetyConfig().catch(e => console.error('[GUARDIAN] startup load failed:', e.message));
