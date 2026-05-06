import React from 'react';
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { Activity, Zap, TrendingUp, Clock } from 'lucide-react';

// ─── Analytics ───────────────────────────────────────────────────────────────
// Event history and per-detector summary panel.
// Receives:
//   history  - array of { time: string, rate: number }  (last N samples)
//   detectors - array of detector node objects
// ─────────────────────────────────────────────────────────────────────────────

export default function Analytics({ history = [], detectors = [] }) {
  const avgRate = history.length
    ? (history.reduce((s, p) => s + Number(p.rate), 0) / history.length).toFixed(2)
    : '—';
  const maxRate = history.length
    ? Math.max(...history.map(p => Number(p.rate))).toFixed(2)
    : '—';
  const onlineCount  = detectors.filter(d => d.status === 'online').length;
  const offlineCount = detectors.filter(d => d.status !== 'online').length;

  return (
    <div className="space-y-8">

      {/* ── Summary stats ─────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-6">
        <StatCard icon={<Activity className="w-4 h-4" />} label="Avg Rate"    value={avgRate} unit="Hz" />
        <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Peak Rate" value={maxRate} unit="Hz" />
        <StatCard icon={<Zap className="w-4 h-4" />}   label="Online"         value={onlineCount}  unit="nodes" color="text-emerald-600" />
        <StatCard icon={<Clock className="w-4 h-4" />} label="Offline"        value={offlineCount} unit="nodes" color={offlineCount > 0 ? 'text-[#be2c2e]' : undefined} />
      </div>

      {/* ── Trigger rate chart ────────────────────────────────────── */}
      <div className="bg-white border border-[#e5e5e5] p-8">
        <h2 className="text-[10px] uppercase font-black tracking-widest text-[#be2c2e] mb-6 flex items-center gap-2">
          <Activity className="w-3 h-3" /> Muon Trigger Rate — Last {history.length} samples
        </h2>
        {history.length > 1 ? (
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="rateGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#be2c2e" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#be2c2e" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 8, fill: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e5e5' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 8, fill: '#9ca3af', fontWeight: 700 }}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 'auto']}
                  unit=" Hz"
                />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 0, fontSize: 11, fontWeight: 700 }}
                  labelStyle={{ color: '#9ca3af', textTransform: 'uppercase', fontSize: 9 }}
                  formatter={(v) => [`${Number(v).toFixed(2)} Hz`, 'Rate']}
                />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke="#be2c2e"
                  strokeWidth={2}
                  fill="url(#rateGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#be2c2e', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState message="Waiting for trigger data…" />
        )}
      </div>

      {/* ── Per-detector HV table ─────────────────────────────────── */}
      <div className="bg-white border border-[#e5e5e5] p-8">
        <h2 className="text-[10px] uppercase font-black tracking-widest text-[#be2c2e] mb-6 flex items-center gap-2">
          <Zap className="w-3 h-3" /> Detector HV Summary
        </h2>
        {detectors.length > 0 ? (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#e5e5e5]">
                {['Node', 'Status', 'CH1 HV', 'POE V', 'POE A', 'Power'].map(h => (
                  <th key={h} className="text-[8px] uppercase font-black text-gray-400 tracking-widest text-left py-2 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detectors.map(d => {
                const ch1  = d.channels?.[0];
                const pwr  = d.power;
                return (
                  <tr key={d.nodeId} className="border-b border-[#f8f8f8] hover:bg-[#fafafa]">
                    <td className="py-2.5 pr-4 font-black text-[#1d1d1b]">{d.name}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`text-[8px] font-black uppercase ${
                        d.status === 'online' ? 'text-emerald-600' : 'text-[#be2c2e]'
                      }`}>{d.status}</span>
                    </td>
                    <td className="py-2.5 pr-4 font-mono">
                      {ch1 ? `${(ch1.current_kv * 1000).toFixed(0)} V` : '—'}
                    </td>
                    <td className="py-2.5 pr-4 font-mono">{pwr ? `${(pwr.v ?? 0).toFixed(1)} V` : '—'}</td>
                    <td className="py-2.5 pr-4 font-mono">{pwr ? `${(pwr.a ?? 0).toFixed(3)} A` : '—'}</td>
                    <td className="py-2.5 font-mono">{pwr ? `${(pwr.w ?? 0).toFixed(1)} W` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState message="No detector data available." />
        )}
      </div>

    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, unit, color = 'text-[#1d1d1b]' }) {
  return (
    <div className="bg-white border border-[#e5e5e5] p-6">
      <p className="text-[8px] uppercase font-black text-gray-400 tracking-widest mb-2 flex items-center gap-1.5">
        {icon}{label}
      </p>
      <p className={`text-3xl font-black ${color}`}>
        {value} <span className="text-sm text-gray-400 font-bold">{unit}</span>
      </p>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <p className="text-[10px] uppercase font-black text-gray-300 tracking-widest py-8 text-center">
      {message}
    </p>
  );
}
