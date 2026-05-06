// =====================================================================
//  node_mapper.js  -- Project Korstmos
//
//  Pure function that converts the ESP32 firmware /status JSON into the
//  canonical "Node" shape consumed by the dashboard frontend (see
//  docs/parallel_dev_plan.md "Interface Contract").
//
//  The output shape is ALWAYS the same, including for offline/error nodes,
//  so downstream code (safety_guardian.checkSafety, frontend NodeCard,
//  telemetry_logger) can rely on the structure and never hit
//  "TypeError: cannot read property X of undefined".
//
//  Output:
//    {
//      nodeId, name, status: 'online' | 'offline' | 'error',
//      channels: [
//        { ch, target_kv, current_kv, target_pot, current_pot, limit_kv },
//        ...
//      ],
//      power: { v, a, w },
//      ups:   { battery_pct, source },
//      sensor_ok: boolean,    // INA226 health from firmware `ok` field
//      lastSeen: ISO string,
//      error: string | null
//    }
//
//  HV unit conversion: per LLM_CONTEXT.md the ESP32 ADC reads 0..3.3V via a
//  divider where 1V at the ADC = 1000V at the HVPS output. So firmware's
//  `hv1` field is already in kV (e.g. 0.625 -> 625V output -> 0.625 kV).
//
//  Pot -> target_kv: firmware reports the AD5282 pot value (0..255) only,
//  not a voltage. Converting requires per-module calibration. Add
//  `kv_per_step` to nodes.json to enable; otherwise target_kv stays null
//  and the frontend should display the raw pot setpoint instead.
// =====================================================================

/**
 * Build a canonical Node object representing an offline detector. Used
 * when fetch times out, returns non-OK, or throws.
 *
 * @param {object} nodeConfig  one entry from nodes.json
 * @param {'offline'|'error'} status
 * @param {string|null} errorMsg  short description of why
 */
export function buildOfflineNode(nodeConfig, status = 'offline', errorMsg = null) {
    return {
        nodeId: nodeConfig.id,
        name: nodeConfig.name || `Detector-${String(nodeConfig.id).padStart(2, '0')}`,
        status,
        channels: [],
        power: { v: 0, a: 0, w: 0 },
        ups: { battery_pct: null, source: 'unknown' },
        sensor_ok: false,
        lastSeen: new Date().toISOString(),
        error: errorMsg
    };
}

/**
 * Map a firmware /status response into the canonical Node shape.
 *
 * @param {object} rawStatus  firmware /status JSON, e.g.
 *                            {v,i,hv1,hv2,p1,p2,c1,c2,ok}
 * @param {object} nodeConfig one entry from nodes.json. May include
 *                            `kv_per_step` for target_kv calibration.
 * @param {object} limits     output of safety_guardian.getLimitsForNode(name).
 *                            May include max_hv_volts (used as channel limit).
 * @returns canonical Node object (status='online')
 */
export function mapStatusToNode(rawStatus, nodeConfig, limits = {}) {
    if (!rawStatus || typeof rawStatus !== 'object') {
        return buildOfflineNode(nodeConfig, 'error', 'empty firmware response');
    }

    const limitKv = (limits.max_hv_volts != null)
        ? limits.max_hv_volts / 1000
        : null;
    const kvPerStep = (typeof nodeConfig.kv_per_step === 'number')
        ? nodeConfig.kv_per_step
        : null;

    const buildChannel = (chNum, hvKey, potTargetKey, potCurrentKey) => {
        const gainKey   = `hv${chNum}g`;
        const offsetKey = `hv${chNum}o`;

        const raw_v     = _toFiniteNumber(rawStatus[hvKey]);
        const gain      = _toFiniteNumber(rawStatus[gainKey]) || 1000; // Default 1V=1000V
        const offset    = _toFiniteNumber(rawStatus[offsetKey]);

        // Formula: (raw_adc_volts * gain + offset) / 1000 => result in kV
        const current_kv  = Number(((raw_v * gain + offset) / 1000).toFixed(4));
        
        const target_pot  = _toFiniteIntegerOrNull(rawStatus[potTargetKey]);
        const current_pot = _toFiniteIntegerOrNull(rawStatus[potCurrentKey]);
        
        // Use local kvPerStep from nodes.json for the target kV estimate if available
        const target_kv   = (kvPerStep != null && target_pot != null)
            ? Number((target_pot * kvPerStep).toFixed(4))
            : null;

        return {
            ch: chNum,
            target_kv,
            current_kv,
            target_pot,
            current_pot,
            limit_kv: limitKv
        };
    };

    return {
        nodeId: nodeConfig.id,
        name: nodeConfig.name || `Detector-${String(nodeConfig.id).padStart(2, '0')}`,
        status: 'online',
        channels: [
            buildChannel(1, 'hv1', 'p1', 'c1'),
            buildChannel(2, 'hv2', 'p2', 'c2')
        ],
        power: {
            v: _toFiniteNumber(rawStatus.v),
            a: _toFiniteNumber(rawStatus.i),                          // firmware names it `i`, not `a`
            w: _toFiniteNumber(rawStatus.v) * _toFiniteNumber(rawStatus.i)
        },
        ups: {
            // Firmware doesn't yet report battery state -- defaults until UPS
            // telemetry is wired up. Source heuristic: PoE rail >30V => mains.
            battery_pct: _toFiniteIntegerOrNull(rawStatus.batt),
            source: _toFiniteNumber(rawStatus.v) > 30 ? 'dc' : 'battery'
        },
        sensor_ok: !!rawStatus.ok,
        lastSeen: new Date().toISOString(),
        error: null
    };
}

// --- helpers -----------------------------------------------------------
function _toFiniteNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}
function _toFiniteIntegerOrNull(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.round(n);
}
