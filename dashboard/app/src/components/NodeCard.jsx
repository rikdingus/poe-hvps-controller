import React from 'react';
import { AlertTriangle, Zap, BatteryMedium, Plug } from 'lucide-react';

// ─── NodeCard ────────────────────────────────────────────────────────────────
// Displays a single HVPS node: status, per-channel HV progress bar,
// power readings, and UPS source. Matches the institutional Tailwind style
// used in App.jsx (white cards, #be2c2e red, tight uppercase labels).
// ─────────────────────────────────────────────────────────────────────────────

export default function NodeCard({ node }) {
  if (!node) return null;
  const { name, status = 'offline', channels = [], power, ups, alert } = node;

  const borderClass = alert
    ? 'border-[#be2c2e]'
    : status === 'online'
      ? 'border-[#e5e5e5]'
      : 'border-gray-200';

  return (
    <div className={`bg-white border ${borderClass} p-6 transition-all`}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex justify-between items-start mb-5">
        <div>
          <p className="text-[9px] uppercase font-black tracking-widest text-gray-400 mb-1">
            HVPS Node
          </p>
          <h3 className="text-base font-black text-[#1d1d1b] leading-none">{name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          {alert && <AlertTriangle className="w-4 h-4 text-[#be2c2e]" />}
        </div>
      </div>

      {/* ── Channels ────────────────────────────────────────────────── */}
      {channels.length > 0
        ? channels.map(ch => <ChannelRow key={ch.ch} ch={ch} />)
        : <p className="text-[10px] text-gray-300 uppercase font-bold mb-4">No channel data</p>
      }

      {/* ── Power row ───────────────────────────────────────────────── */}
      {power && (
        <div className="mt-4 pt-4 border-t border-[#f0f0f0] grid grid-cols-3 gap-3">
          <Stat icon={<Zap className="w-3 h-3" />} label="Voltage" value={`${(power.v ?? 0).toFixed(1)} V`} />
          <Stat label="Current" value={`${(power.a ?? 0).toFixed(3)} A`} />
          <Stat label="Power"   value={`${(power.w ?? 0).toFixed(1)} W`} />
        </div>
      )}

      {/* ── UPS / power source ──────────────────────────────────────── */}
      {ups && (
        <div className="mt-3 flex justify-between items-center">
          <span className="text-[8px] uppercase font-black text-gray-300 tracking-widest">Source</span>
          {ups.source === 'battery' ? (
            <span className="text-[9px] font-black text-amber-500 flex items-center gap-1">
              <BatteryMedium className="w-3 h-3" />
              Battery {ups.battery_pct}%
            </span>
          ) : (
            <span className="text-[9px] font-black text-emerald-600 flex items-center gap-1">
              <Plug className="w-3 h-3" />
              DC Supply
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    online:  { dot: 'bg-emerald-500 animate-pulse', text: 'text-emerald-600' },
    offline: { dot: 'bg-gray-300',                  text: 'text-gray-400'    },
    error:   { dot: 'bg-[#be2c2e]',                 text: 'text-[#be2c2e]'  },
  };
  const s = map[status] || map.offline;

  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
      <span className={`text-[9px] font-black uppercase tracking-widest ${s.text}`}>{status}</span>
    </div>
  );
}

// ─── ChannelRow ──────────────────────────────────────────────────────────────
// Shows current HV as a labelled value + progress bar (current vs limit).
// A ramping indicator appears when target and current differ by > 10 V.
function ChannelRow({ ch }) {
  const currentV = (ch.current_kv ?? 0) * 1000;      // convert kV → V for display
  const targetV  = (ch.target_kv  ?? 0) * 1000;
  const limitV   = (ch.limit_kv   ?? 3.0) * 1000;

  // Clamp to [0, 100] to avoid visual weirdness during ramps / overshoots
  const pct      = Math.min(100, Math.max(0, (currentV / limitV) * 100));
  const isRamping = Math.abs(currentV - targetV) > 10;   // > 10 V difference = actively ramping

  // Colour the bar green normally, amber when near limit (>80%), red if over limit
  const barColor = pct > 100 ? 'bg-[#be2c2e]' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="mb-4">
      <div className="flex justify-between items-end mb-1.5">
        <span className="text-[8px] uppercase font-black text-gray-400 tracking-widest">
          CH{ch.ch} HV
        </span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-black text-[#1d1d1b] leading-none">
            {currentV.toFixed(0)}
          </span>
          <span className="text-[9px] font-bold text-gray-400">V</span>
          {isRamping && (
            <span className="text-[8px] font-black text-amber-500 uppercase ml-1">
              → {targetV.toFixed(0)} V
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex justify-between mt-0.5">
        <span className="text-[7px] text-gray-300 font-bold">0</span>
        <span className="text-[7px] text-gray-300 font-bold">{limitV.toFixed(0)} V max</span>
      </div>
    </div>
  );
}

// ─── Stat ────────────────────────────────────────────────────────────────────
function Stat({ label, value, icon }) {
  return (
    <div>
      <span className="text-[7px] uppercase font-black text-gray-300 block mb-0.5 tracking-widest flex items-center gap-1">
        {icon}{label}
      </span>
      <span className="text-xs font-bold text-[#1d1d1b]">{value}</span>
    </div>
  );
}
