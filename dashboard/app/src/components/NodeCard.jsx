import React from 'react';
import { AlertTriangle, Zap, BatteryMedium, Plug, Cpu, Activity } from 'lucide-react';

// ─── StatusBadge ─────────────────────────────────────────────────────────────
function StatusBadge({ status, darkMode }) {
  const map = {
    online:  { dot: 'bg-emerald-500 animate-pulse', text: darkMode ? 'text-emerald-400' : 'text-emerald-600' },
    offline: { dot: 'bg-gray-400',                  text: darkMode ? 'text-zinc-400' : 'text-gray-600'    },
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
function ChannelRow({ ch, darkMode }) {
  const currentKv = ch.current_kv ?? 0;
  const targetKv  = ch.target_kv  ?? 0;
  const limitKv   = ch.limit_kv   ?? 2.5;

  const rawPct    = (currentKv / limitKv) * 100;
  const pct       = Math.min(100, Math.max(0, rawPct));
  const isRamping = Math.abs(currentKv - targetKv) > 0.01; 

  const isExceeded = currentKv > limitKv;
  const barColor  = isExceeded ? 'bg-[#be2c2e]' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="mb-4">
      <div className="flex justify-between items-end mb-1.5">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className={`text-[8px] uppercase font-black tracking-widest ${darkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
              CH{ch.ch} HV
            </span>
            {isExceeded && (
              <span className="text-[7px] font-black text-[#be2c2e] uppercase tracking-wider animate-pulse">
                [Over Limit]
              </span>
            )}
          </div>
          <span className="text-[7px] text-gray-500 font-bold uppercase tracking-widest">
             {targetKv > 0 ? `Target: ${targetKv.toFixed(3)} kV` : 'No Target'}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className={`text-2xl font-black leading-none ${isExceeded ? 'text-[#be2c2e]' : darkMode ? 'text-white' : 'text-[#1d1d1b]'}`}>
            {currentKv.toFixed(3)}
          </span>
          <span className={`text-[9px] font-bold ${isExceeded ? 'text-[#be2c2e]' : darkMode ? 'text-zinc-400' : 'text-gray-600'}`}>kV</span>
          {isRamping && (
            <span className="text-[8px] font-black text-amber-500 uppercase ml-1 animate-pulse">
              → {targetKv.toFixed(3)}
            </span>
          )}
        </div>
      </div>

      <div className={`w-full h-1.5 rounded-full overflow-hidden ${darkMode ? 'bg-zinc-800' : 'bg-gray-100'}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex justify-between mt-0.5">
        <span className="text-[7px] text-gray-500 font-bold">0</span>
        {ch.hz !== undefined && (
          <span className="text-[7px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1">
            <Activity className={`w-2.5 h-2.5 text-emerald-500 ${ch.hz > 0 ? 'animate-pulse' : ''}`} />
            {ch.hz.toFixed(2)} Hz · {ch.hits.toLocaleString()} hits
          </span>
        )}
        <span className="text-[7px] text-gray-500 font-bold">{limitKv.toFixed(1)} kV max</span>
      </div>
    </div>
  );
}

// ─── Stat ────────────────────────────────────────────────────────────────────
function Stat({ label, value, icon, darkMode }) {
  return (
    <div>
      <span className={`text-[7px] uppercase font-black block mb-0.5 tracking-widest flex items-center gap-1 ${darkMode ? 'text-zinc-400' : 'text-gray-500'}`}>
        {icon}{label}
      </span>
      <span className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-[#1d1d1b]'}`}>{value}</span>
    </div>
  );
}

// ─── NodeCard ────────────────────────────────────────────────────────────────
export default function NodeCard({ node, darkMode }) {
  if (!node) return null;
  const { name, status = 'offline', channels = [], power, ups, alert } = node;
  const isOnline = status === 'online';

  const isLimitExceeded = channels.some(ch => (ch.current_kv ?? 0) > (ch.limit_kv ?? 2.5));

  const borderClass = alert || (status === 'error') || isLimitExceeded
    ? 'border-[#be2c2e] ring-4 ring-[#be2c2e]/10 shadow-2xl'
    : isOnline
      ? darkMode
        ? 'border-[#222533] bg-[#151722] shadow-sm hover:shadow-lg hover:-translate-y-0.5'
        : 'border-[#e5e5e5] bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5'
      : darkMode
        ? 'border-[#1e2330] bg-[#111217] opacity-60 hover:opacity-80'
        : 'border-gray-200 bg-white opacity-60 hover:opacity-80';

  return (
    <div className={`relative border ${borderClass} transition-all duration-300 overflow-hidden`}>
      {/* Institutional Ribbon */}
      <div className={`h-1.5 w-full ${isOnline ? ((alert || isLimitExceeded) ? 'bg-[#be2c2e]' : 'bg-[#1d1d1b]') : 'bg-gray-200'}`} />

      <div className="p-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div className="flex items-center gap-4">
             <div className={`p-2 ${isOnline ? (darkMode ? 'bg-zinc-800 text-white' : 'bg-[#1d1d1b] text-white') : 'bg-gray-100 text-gray-600'}`}>
                <Cpu className="w-5 h-5" />
             </div>
             <div>
                <h3 className={`text-lg font-black tracking-tighter uppercase leading-none ${darkMode ? 'text-white' : 'text-[#1d1d1b]'}`}>
                  {name || `Node-${String(node.nodeId).padStart(2, '0')}`}
                </h3>
                <p className={`text-[9px] uppercase font-bold tracking-[0.3em] mt-1 ${darkMode ? 'text-zinc-400' : 'text-gray-600'}`}>PMT Detector Array</p>
             </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={status} darkMode={darkMode} />
            {(alert || isLimitExceeded) && (
              <span className="flex items-center gap-1 bg-[#be2c2e]/10 text-[#be2c2e] px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider animate-pulse">
                <AlertTriangle className="w-3 h-3 text-[#be2c2e]" />
                {isLimitExceeded ? 'Limit Exceeded' : 'Halted'}
              </span>
            )}
          </div>
        </div>

        {/* Channels */}
        <div className="space-y-2">
          {channels.length > 0
            ? channels.map(ch => <ChannelRow key={ch.ch} ch={ch} darkMode={darkMode} />)
            : <div className={`h-24 flex items-center justify-center border-2 border-dashed ${darkMode ? 'border-zinc-800' : 'border-gray-200'}`}>
                 <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">No Channel Telemetry</span>
              </div>
          }
        </div>

        {/* Secondary Metrics */}
        <div className={`grid grid-cols-3 gap-4 mt-8 pt-8 border-t ${darkMode ? 'border-zinc-800/80' : 'border-gray-100'}`}>
          <div className="space-y-1">
            <p className={`text-[10px] uppercase font-black tracking-widest ${darkMode ? 'text-zinc-400' : 'text-gray-600'}`}>PoE Input</p>
            <p className={`text-lg font-black ${darkMode ? 'text-white' : 'text-[#1d1d1b]'}`}>
              {isOnline ? `${(power?.poe_v || power?.board_v || power?.v || 0).toFixed(1)}` : '--'} <span className="text-[10px]">V</span>
            </p>
          </div>
          <div className="space-y-1 text-center">
            <p className={`text-[10px] uppercase font-black tracking-widest ${darkMode ? 'text-zinc-400' : 'text-gray-600'}`}>PoE Current</p>
            <p className={`text-lg font-black ${darkMode ? 'text-white' : 'text-[#1d1d1b]'}`}>
              {isOnline && (power?.poe_ma != null || node.sensor_ok) ? `${power?.poe_ma ?? ((power?.a * 1000)?.toFixed(0) || '0')}` : '--'} <span className="text-[10px]">mA</span>
            </p>
          </div>
          <div className="space-y-1 text-right">
            <p className={`text-[10px] uppercase font-black tracking-widest ${darkMode ? 'text-zinc-400' : 'text-gray-600'}`}>PoE Power</p>
            <p className={`text-lg font-black ${darkMode ? 'text-white' : 'text-[#1d1d1b]'}`}>
              {isOnline && (power?.poe_w != null || node.sensor_ok) ? `${(power?.poe_w ?? power?.w ?? 0).toFixed(1)}` : '--'} <span className="text-[10px]">W</span>
            </p>
          </div>
        </div>

        {/* UPS / power source */}
        {isOnline && ups && (
          <div className={`mt-6 pt-6 border-t flex justify-between items-center ${darkMode ? 'border-zinc-800/40' : 'border-gray-50'}`}>
            <span className={`text-[8px] uppercase font-black tracking-widest ${darkMode ? 'text-zinc-400' : 'text-gray-600'}`}>Feed Source</span>
            {(power?.poe_v > 0 || power?.ext_power) ? (
              <span className="text-[9px] font-black text-emerald-600 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                POE — {(power?.poe_v || power?.board_v || power?.v || 0).toFixed(1)}V
              </span>
            ) : ups.source === 'battery' ? (
              <span className="text-[9px] font-black text-amber-500 flex items-center gap-2">
                <BatteryMedium className="w-4 h-4" />
                BATTERY {ups.battery_pct}%
              </span>
            ) : (
              <span className="text-[9px] font-black text-emerald-600 flex items-center gap-2">
                <Plug className="w-4 h-4" />
                MAINS OK
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className={`mt-6 pt-6 border-t flex justify-end ${darkMode ? 'border-zinc-800/80' : 'border-gray-100'}`}>
          <button
            onClick={async () => {
              if (!window.confirm(`Are you sure you want to hard reboot ${name || `Node ${node.nodeId}`}? This will power-cycle the PoE port.`)) {
                return;
              }
              const btn = document.getElementById(`reboot-btn-${node.nodeId}`);
              if (btn) btn.disabled = true;
              try {
                const headers = { 'Content-Type': 'application/json' };
                const token = localStorage.getItem('DASHBOARD_API_TOKEN');
                if (token) {
                  headers['Authorization'] = `Bearer ${token}`;
                }
                const res = await fetch(`/api/reboot-detector/${node.nodeId}`, {
                  method: 'POST',
                  headers
                });
                if (res.ok) {
                  window.alert(`Reboot command sent successfully for ${name || `Node ${node.nodeId}`}.`);
                } else {
                  const err = await res.json();
                  window.alert(`Failed to reboot: ${err.error || res.statusText}`);
                }
              } catch (e) {
                window.alert(`Network error: ${e.message}`);
              } finally {
                if (btn) btn.disabled = false;
              }
            }}
            id={`reboot-btn-${node.nodeId}`}
            className={`text-[9px] uppercase font-black tracking-widest px-4 py-2 transition-all disabled:opacity-50 border ${
              darkMode 
                ? 'text-[#be2c2e] hover:text-white hover:bg-[#be2c2e] border-[#be2c2e]/40 hover:border-[#be2c2e]' 
                : 'text-[#be2c2e] hover:text-white hover:bg-[#be2c2e] border border-[#be2c2e]/20 hover:border-[#be2c2e]'
            }`}
          >
            Hard Reboot ↺
          </button>
        </div>
      </div>
    </div>
  );
}
