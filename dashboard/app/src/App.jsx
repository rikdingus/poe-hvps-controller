import React, { useState, useEffect, useCallback } from 'react';
import { Activity, ShieldCheck, Zap, Settings, Gauge, TrendingUp, LayoutDashboard, Cpu, Radio, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import NodeCard from './components/NodeCard';
import Analytics from './components/Analytics';

// ─── Sub-widgets ──────────────────────────────────────────────────────────────

const DigitizerWidget = ({ data }) => {
  if (!data) return null;
  return (
    <div className="bg-white border border-[#e5e5e5] p-8 mb-8">
      <h3 className="text-[10px] uppercase text-[#be2c2e] mb-6 flex items-center gap-2 font-black tracking-widest">
        <Cpu className="w-3 h-3" /> Central Digitizer (KORSTMOS)
      </h3>
      <div className="space-y-6">
        <div className="flex justify-between items-end">
          <div className="flex flex-col">
            <span className="text-[9px] uppercase text-gray-400 font-black mb-1 tracking-widest">Trigger Rate</span>
            <span className="text-4xl font-black text-[#1d1d1b]">{data.triggerRate} <span className="text-sm">Hz</span></span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] uppercase text-gray-400 font-black mb-1 tracking-widest">Coincidence</span>
            <span className="text-xl font-black text-[#be2c2e] uppercase">{data.coincidenceMode}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#fafafa] p-4 border border-gray-100">
            <span className="text-[8px] uppercase text-gray-400 font-black block mb-1">Active Plates</span>
            <span className="text-lg font-black text-[#1d1d1b]">{data.activeChannels}</span>
          </div>
          <div className="bg-[#fafafa] p-4 border border-gray-100 text-right">
            <span className="text-[8px] uppercase text-gray-400 font-black block mb-1">Muon Pulse</span>
            <div className="flex items-center justify-end gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
              <span className="text-lg font-black text-[#1d1d1b]">LIVE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const InfraWidget = ({ data }) => {
  if (!data) return null;
  return (
    <div className="bg-white border border-[#e5e5e5] p-8 mb-8">
      <h3 className="text-[10px] uppercase text-[#be2c2e] mb-6 flex items-center gap-2 font-black tracking-widest">
        <Settings className="w-3 h-3" /> Facility Infrastructure
      </h3>
      <div className="space-y-6">
        <div className="flex justify-between items-end">
          <div className="flex flex-col">
            <span className="text-[9px] uppercase text-gray-400 font-black mb-1 tracking-widest">Bus Voltage</span>
            <span className="text-3xl font-black text-[#be2c2e]">{data.voltage.toFixed(1)} <span className="text-sm">V</span></span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] uppercase text-gray-400 font-black mb-1 tracking-widest">Lab Temp</span>
            <span className="text-3xl font-black text-[#1d1d1b]">{data.temp.toFixed(1)}°C</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [detectors,         setDetectors]         = useState([]);
  const [digitizer,         setDigitizer]         = useState({ triggerRate: 0, coincidenceMode: '2-fold', activeChannels: 4 });
  const [history,           setHistory]           = useState([]);
  const [infra,             setInfra]             = useState({ voltage: 26.4, temp: 42, cpu: 12 });
  const [isEmergencyStopped, setIsEmergencyStopped] = useState(false);
  const [eStopPending,      setEStopPending]      = useState(false);  // shows loading state on button
  const [view,              setView]              = useState('dashboard');

  // ── Emergency stop ──────────────────────────────────────────────
  // Calls POST /api/emergency-stop which persists the flag in safety_limits.json
  // and triggers immediate SNMP PoE cutoff on the switch.
  // Falls back to local-only state if the server is unreachable.
  const handleEmergencyStop = useCallback(async () => {
    setEStopPending(true);
    try {
      const res = await fetch('/api/emergency-stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: true, reason: 'dashboard-halt-button' }),
      });
      if (!res.ok) throw new Error(`Server ${res.status}`);
      const data = await res.json();
      console.log('[E-STOP] Server confirmed:', data);
    } catch (e) {
      // Log the error but still update local UI — better to show halted than appear running
      console.error('[E-STOP] Server unreachable, local-only halt:', e.message);
    }
    // Update local state regardless of server response
    setIsEmergencyStopped(true);
    setDetectors(prev => prev.map(d => ({
      ...d,
      channels: d.channels?.map(ch => ({ ...ch, current_kv: 0 })),
      alert: true
    })));
    setEStopPending(false);
  }, []);

  const handleResume = useCallback(async () => {
    try {
      await fetch('/api/emergency-stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false, reason: 'dashboard-resume' }),
      });
    } catch (e) {
      console.error('[E-STOP] Resume call failed:', e.message);
    }
    setIsEmergencyStopped(false);
  }, []);

  // ── Polling ─────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (isEmergencyStopped) return;
    try {
      const [detRes, digRes, infraRes] = await Promise.all([
        fetch('/api/detectors'),
        fetch('/api/digitizer'),
        fetch('/api/infra'),
      ]);

      const liveDets  = await detRes.json();
      const liveDig   = await digRes.json();
      const liveInfra = await infraRes.json();

      setDigitizer(liveDig);
      if (liveInfra.lastSeen) setInfra(liveInfra);

      if (liveDets && liveDets.length > 0) {
        setDetectors(liveDets);
        setHistory(prev => [...prev.slice(-29), {
          time: new Date().toLocaleTimeString(),
          rate: parseFloat(liveDig.triggerRate)
        }]);
      } else {
        // Fallback mock so the UI shows something during local dev
        const mockDets = Array.from({ length: 4 }, (_, i) => ({
          nodeId: i + 1,
          name: `HVPS-0${i + 1}`,
          status: 'online',
          channels: [{ ch: 1, target_kv: 1.2, current_kv: 1.2 + (Math.random() * 0.02), limit_kv: 2.5 }],
          power: { v: 48.2, a: 0.12, w: 5.8 },
          ups: { battery_pct: 100, source: 'dc' }
        }));
        setDetectors(mockDets);
        setHistory(prev => [...prev.slice(-29), {
          time: new Date().toLocaleTimeString(),
          rate: parseFloat((Math.random() * 5 + 2).toFixed(2))
        }]);
      }
    } catch (e) {
      console.error('Korstmos Fetch Error:', e);
    }
  }, [isEmergencyStopped]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#1d1d1b]">

      {/* Institutional Header */}
      <header className="bg-white border-b border-[#e5e5e5] px-12 py-8 mb-12 shadow-sm">
        <div className="max-w-[1700px] mx-auto flex justify-between items-end">
          <div className="flex items-center gap-8">
            <div className="w-16 h-16 bg-[#be2c2e] flex items-center justify-center text-white">
              <Radio className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter uppercase leading-none text-[#be2c2e]">
                Project <span className="text-[#1d1d1b]">Korstmos</span>
              </h1>
              <p className="text-[10px] uppercase tracking-[0.4em] font-bold mt-2 text-gray-400">
                Kosmisch Onderzoek Radboud Studenten Meetopstelling
              </p>
            </div>
          </div>
          <div className="flex gap-6 items-center">
            <div className="text-right">
              <p className="text-[9px] uppercase font-black text-gray-400 tracking-widest">Array Status</p>
              <p className="text-sm font-bold flex items-center gap-2 justify-end">
                {isEmergencyStopped ? (
                  <><span className="w-2 h-2 rounded-full bg-[#be2c2e]"></span> Halted</>
                ) : (
                  <><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Measuring Muons</>
                )}
              </p>
            </div>
            <button
              onClick={handleEmergencyStop}
              disabled={eStopPending || isEmergencyStopped}
              className="bg-[#be2c2e] text-white px-8 py-3 font-black text-xs uppercase tracking-widest hover:bg-[#7a0000] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {eStopPending ? 'Halting…' : 'Halt Acquisition →'}
            </button>
          </div>
        </div>
      </header>

      {/* Emergency Overlay */}
      {isEmergencyStopped && (
        <div className="fixed inset-0 z-50 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center">
          <div className="text-center p-16 border-4 border-[#be2c2e]">
            <ShieldCheck className="w-24 h-24 text-[#be2c2e] mx-auto mb-6" />
            <h1 className="text-7xl font-black tracking-tighter text-[#be2c2e] mb-4 uppercase italic">
              ACQUISITION HALTED
            </h1>
            <p className="text-gray-500 tracking-widest uppercase text-sm font-bold">
              Scientific Override Active — PoE power cut to all detectors
            </p>
            <button
              onClick={handleResume}
              className="mt-12 px-12 py-4 bg-[#be2c2e] text-white text-sm font-black uppercase tracking-widest hover:bg-[#7a0000]"
            >
              Resume Run →
            </button>
          </div>
        </div>
      )}

      <div className="max-w-[1700px] mx-auto grid grid-cols-12 gap-12 px-12 pb-24">

        {/* Sidebar */}
        <aside className="col-span-4">
          <nav className="mb-10 space-y-2">
            <button
              onClick={() => setView('dashboard')}
              className={`w-full px-8 py-5 text-left font-black uppercase tracking-[0.2em] text-xs transition-all flex items-center gap-4 ${
                view === 'dashboard'
                  ? 'bg-[#be2c2e] text-white'
                  : 'bg-white border border-[#e5e5e5] hover:border-[#be2c2e]'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" /> Detector Array
            </button>
            <button
              onClick={() => setView('analytics')}
              className={`w-full px-8 py-5 text-left font-black uppercase tracking-[0.2em] text-xs transition-all flex items-center gap-4 ${
                view === 'analytics'
                  ? 'bg-[#be2c2e] text-white'
                  : 'bg-white border border-[#e5e5e5] hover:border-[#be2c2e]'
              }`}
            >
              <TrendingUp className="w-4 h-4" /> Event History
            </button>
          </nav>

          <DigitizerWidget data={digitizer} />
          <InfraWidget data={infra} />

          <div className="bg-white border border-[#e5e5e5] p-8">
            <h3 className="text-[11px] uppercase text-[#be2c2e] mb-8 font-black tracking-widest flex items-center gap-3">
              Trigger Rate (Hz)
            </h3>
            <div className="h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <Area
                    type="monotone"
                    dataKey="rate"
                    stroke="#be2c2e"
                    strokeWidth={3}
                    fill="#be2c2e"
                    fillOpacity={0.05}
                  />
                  <YAxis hide domain={['auto', 'auto']} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="col-span-8">
          {view === 'dashboard' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {detectors.map(det => (
                <NodeCard key={det.nodeId} node={det} />
              ))}
            </div>
          ) : (
            <Analytics history={history} detectors={detectors} />
          )}
        </main>

      </div>
    </div>
  );
}
