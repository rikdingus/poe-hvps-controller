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
import crypto from 'crypto';
import fetch from 'node-fetch';

const MIKROTIK_IP          = process.env.MIKROTIK_IP          || '192.168.88.1';
const SNMP_COMMUNITY_WRITE = process.env.SNMP_COMMUNITY_WRITE || 'private';
const SAFETY_CONFIG_PATH   = process.env.SAFETY_CONFIG        || path.resolve(process.cwd(), '../config/safety_limits.json');
// MikroTik PoE control OID. Values: 1=auto-on, 2=forced-on, 3=off.
const POE_CONTROL_OID      = '1.3.6.1.4.1.14988.1.1.15.1.1.2';

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

// --- SwOS HTTP PoE Control Helpers ----------------------------------
const getNodesConfigPath = () => {
    if (process.env.NODES_CONFIG) return process.env.NODES_CONFIG;
    const isDemo = process.env.DEMO_MODE === 'true';
    return path.resolve(process.cwd(), isDemo ? '../config/nodes.demo.json' : '../config/nodes.json');
};

let _cachedAuth = null;

function md5(str) {
    return crypto.createHash('md5').update(str).digest('hex');
}

function parseAuthHeader(header) {
    const obj = {};
    const matches = header.matchAll(/([a-zA-Z0-9_-]+)="?([^",]+)"?/g);
    for (const match of matches) {
        obj[match[1]] = match[2];
    }
    const matches2 = header.matchAll(/([a-zA-Z0-9_-]+)=([a-zA-Z0-9_-]+)/g);
    for (const match of matches2) {
        if (!obj[match[1]]) {
            obj[match[1]] = match[2];
        }
    }
    return obj;
}

export function parseSwosResponse(text) {
    let cleaned = text.trim();
    cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');
    if (cleaned.startsWith('{')) {
        cleaned = cleaned.replace(/^\{\s*([a-zA-Z0-9_]+)\s*:/, '{"$1":');
    }
    cleaned = cleaned.replace(/0x([0-9a-fA-F]+)/g, (match, hex) => parseInt(hex, 16));
    // Remove trailing commas in arrays/objects
    cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');
    return JSON.parse(cleaned);
}

export async function fetchWithDigest(url, options = {}) {
    const username = process.env.MIKROTIK_USERNAME || 'admin';
    const password = process.env.MIKROTIK_PASSWORD || '';
    
    const urlObj = new URL(url);
    const uri = urlObj.pathname + urlObj.search;
    const method = options.method || 'GET';
    
    function buildHeader(auth, ncValue) {
        const cnonce = crypto.randomBytes(8).toString('hex');
        const nc = String(ncValue).padStart(8, '0');
        const ha1 = md5(`${username}:${auth.realm}:${password}`);
        const ha2 = md5(`${method}:${uri}`);
        
        let response;
        if (auth.qop) {
            response = md5(`${ha1}:${auth.nonce}:${nc}:${cnonce}:${auth.qop}:${ha2}`);
        } else {
            response = md5(`${ha1}:${auth.nonce}:${ha2}`);
        }
        
        let authHeader = `Digest username="${username}", realm="${auth.realm}", nonce="${auth.nonce}", uri="${uri}", response="${response}"`;
        if (auth.qop) {
            authHeader += `, qop=${auth.qop}, nc=${nc}, cnonce="${cnonce}"`;
        }
        if (auth.opaque) {
            authHeader += `, opaque="${auth.opaque}"`;
        }
        return authHeader;
    }
    
    let headers = { ...(options.headers || {}) };
    if (_cachedAuth) {
        _cachedAuth.nc += 1;
        headers['Authorization'] = buildHeader(_cachedAuth, _cachedAuth.nc);
    }
    
    let res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
        const authHeaderValue = res.headers.get('www-authenticate');
        if (!authHeaderValue) {
            throw new Error('401 unauthorized with no WWW-Authenticate header');
        }
        
        const authParams = parseAuthHeader(authHeaderValue);
        _cachedAuth = {
            realm: authParams.realm,
            nonce: authParams.nonce,
            qop: authParams.qop,
            opaque: authParams.opaque,
            nc: 1
        };
        
        headers = { ...(options.headers || {}) };
        headers['Authorization'] = buildHeader(_cachedAuth, _cachedAuth.nc);
        res = await fetch(url, { ...options, headers });
    }
    
    return res;
}

export async function getPoePortForNode(nodeId) {
    try {
        const raw = await fs.readFile(getNodesConfigPath(), 'utf-8');
        const nodes = JSON.parse(raw);
        const node = nodes.find(n => n.id === nodeId);
        if (node && typeof node.poe_port === 'number') {
            return node.poe_port;
        }
    } catch (e) {
        console.warn(`[GUARDIAN] Failed to read nodes config for poe_port lookup: ${e.message}`);
    }
    return nodeId + 1;
}

export const virtualPoePorts = {};

export async function setPoeState(port, state) {
    if (process.env.DEMO_MODE === 'true') {
        virtualPoePorts[port] = state;
        console.log(`[DEMO_MODE] Mocking setPoeState: port ${port} set to ${state}`);
        return;
    }
    const method = process.env.POE_CONTROL_METHOD || 'routeros-snmp';
    
    if (method === 'swos-http') {
        const ip = process.env.MIKROTIK_IP || '192.168.88.1';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        let res;
        try {
            res = await fetchWithDigest(`http://${ip}/poe.b`, { signal: controller.signal });
        } finally {
            clearTimeout(timeoutId);
        }
        
        if (!res.ok) {
            throw new Error(`Failed to fetch current SwOS PoE config: HTTP ${res.status}`);
        }
        const text = await res.text();
        const data = parseSwosResponse(text);
        
        const key = data.i01 ? 'i01' : (data.poe ? 'poe' : null);
        if (!key) {
            throw new Error('Could not find PoE control array in SwOS response');
        }
        
        const poeArray = data[key];
        const idx = port - 1;
        if (idx < 0 || idx >= poeArray.length) {
            throw new Error(`PoE port ${port} is out of range for SwOS switch (length ${poeArray.length})`);
        }
        
        // SwOS states: 0 = off, 1 = auto, 2 = on
        poeArray[idx] = state === 0 ? 0 : 1;
        
        const payload = JSON.stringify({ [key]: poeArray });
        const postController = new AbortController();
        const postTimeoutId = setTimeout(() => postController.abort(), 3000);
        
        let postRes;
        try {
            postRes = await fetchWithDigest(`http://${ip}/poe.b`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-javascript'
                },
                body: payload,
                signal: postController.signal
            });
        } finally {
            clearTimeout(postTimeoutId);
        }
        
        if (!postRes.ok) {
            throw new Error(`Failed to POST SwOS PoE config: HTTP ${postRes.status}`);
        }
    } else {
        if (!_snmpModule) {
            _snmpModule = (await import('net-snmp')).default;
        }
        if (!_snmpSession) {
            _snmpSession = _snmpModule.createSession(MIKROTIK_IP, SNMP_COMMUNITY_WRITE);
        }
        const oid = `${POE_CONTROL_OID}.${port}`;
        return new Promise((resolve, reject) => {
            const val = state === 0 ? 3 : 1;
            _snmpSession.set(
                [{ oid, type: _snmpModule.ObjectType.Integer, value: val }],
                (error) => error ? reject(error) : resolve()
            );
        });
    }
}

// --- default shutdown switcher (SwOS HTTP or RouterOS SNMP) -----------
async function _defaultShutdown(nodeId) {
    const port = await getPoePortForNode(nodeId);
    return setPoeState(port, 0);
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
