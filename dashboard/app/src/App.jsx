import React, { useState, useEffect, useRef } from 'react';
import { Activity, ShieldCheck, Zap, Power, Settings, Gauge, TrendingUp } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import NodeCard from './components/NodeCard';

const QuotaWidget = ({ credits }) => {
  if (!credits) return null;
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
      <h3 className="text-[10px] uppercase text-white/40 mb-3 flex items-center gap-2 font-bold tracking-widest">
        <Gauge className="w-3 h-3 text-violet-400" /> AI Fuel Status
      </h3>
      <div className="space-y-4">
        {Object.entries(credits.models).map(([key, model]) => (
          <div key={key}>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-white/60 uppercase">{model.display_name}</span>
              <span className={model.status === 'DEPLETED' ? 'text-red-400' : 'text-emerald-400 font-bold'}>
                {model.status}
              </span>
            </div>
            <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ${model.status === 'DEPLETED' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-gradient-to-r from-emerald-500 to-cyan-400'}`}
                style={{ width: `${(model.credits_remaining / model.total_budget) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function App() {
  const [nodes, setNodes] = useState([]);
  const [history, setHistory] = useState([]);
  const [credits, setCredits] = useState(null);
  const [isEmergencyStopped, setIsEmergencyStopped] = useState(false);
  
  const handleEmergencyStop = () => {
    setIsEmergencyStopped(true);
    setNodes(prev => prev.map(node => ({
      ...node,
      channels: node.channels.map(ch => ({ ...ch, current_kv: 0 })),
      alert: true
    })));
  };

  const fetchData = async () => {
    if (isEmergencyStopped) return;

    try {
      const mockNodes = Array.from({ length: 10 }, (_, i) => {
        const hasFault = Math.random() > 0.98;
        const kv = hasFault ? 3.1 : (0.5 + (Math.random() * 0.05));
        
        return {
          nodeId: i + 1,
          status: i === 0 ? 'online' : (Math.random() > 0.1 ? 'online' : 'offline'),
          channels: [{ ch: 1, target_kv: 0.5, current_kv: kv, limit_kv: 3.0 }],
          power: { v: 48.2, a: hasFault ? 0.8 : (0.05 + Math.random() * 0.1), w: hasFault ? 38 : (5.8 + Math.random() * 2) },
          ups: { battery_pct: 92, source: 'dc' },
          alert: hasFault
        };
      });

      setNodes(mockNodes);

      // Aggregate history for System Load chart
      const totalW = mockNodes.reduce((sum, n) => sum + (n.status === 'online' ? n.power.w : 0), 0);
      setHistory(prev => [...prev.slice(-29), { time: new Date().toLocaleTimeString().split(' ')[0], load: totalW }]);

    } catch (e) {
      console.error('Fetch Error:', e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [isEmergencyStopped]);

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-8">
      {/* Emergency Overlay omitted for brevity in diff but remains implemented */}
      {isEmergencyStopped && (
        <div className="fixed inset-0 z-50 bg-red-900/40 backdrop-blur-md flex flex-col items-center justify-center pointer-events-none">
          <div className="glass bg-black/40 p-12 rounded-[40px] border-red-500/50 text-center">
            <ShieldCheck className="w-20 h-20 text-red-500 mx-auto mb-6 animate-pulse" />
            <h1 className="text-6xl font-black tracking-tighter text-red-500 mb-2 uppercase">Emergency Stop Active</h1>
            <p className="text-white/60 tracking-widest uppercase text-sm">All Outputs Inhibited</p>
            <button onClick={() => setIsEmergencyStopped(false)} className="mt-8 px-8 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold uppercase tracking-widest pointer-events-auto">Reset System</button>
          </div>
        </div>
      )}

      <div className="max-w-[1700px] mx-auto grid grid-cols-12 gap-8">
        
        {/* Sidebar */}
        <aside className="col-span-3 h-[calc(100vh-64px)] sticky top-8 flex flex-col">
          <div className="flex items-center gap-4 mb-12">
            <div className="p-3 rounded-2xl bg-cyan-500/20 border border-cyan-500/20 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
              <Activity className="w-8 h-8 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-light tracking-tight">Research Station <span className="font-bold text-cyan-400">Alpha</span></h1>
              <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold">Laboratory Control Center</p>
            </div>
          </div>

          <QuotaWidget credits={credits} />

          {/* System Load Trend Chart */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 mb-6 flex-1 flex flex-col overflow-hidden">
             <h3 className="text-[10px] uppercase text-white/40 mb-6 flex items-center gap-2 font-bold tracking-widest">
              <TrendingUp className="w-3 h-3 text-cyan-400" /> System Load Trend (Watts)
            </h3>
            <div className="flex-1 min-h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="load" stroke="#22d3ee" strokeWidth={2} fillOpacity={1} fill="url(#colorLoad)" />
                  <YAxis hide domain={['auto', 'auto']} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
            <h3 className="text-[10px] uppercase text-white/40 mb-4 flex items-center gap-2 font-bold tracking-widest">
              <ShieldCheck className="w-3 h-3 text-emerald-400" /> Security Status
            </h3>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center"><span className="text-xs text-white/60">WireGuard Mesh</span><span className="text-[10px] font-bold text-emerald-400 uppercase tracking-tighter">Active Handshake</span></div>
              <div className="flex justify-between items-center"><span className="text-xs text-white/60">Node Proxy</span><span className="text-[10px] font-bold text-emerald-400 uppercase tracking-tighter">10 Nodes Connected</span></div>
            </div>
            <button onClick={handleEmergencyStop} className="w-full py-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-red-500/20 transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
              <Power className="w-4 h-4" /> Global Emergency Stop
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="col-span-9">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {nodes.map(node => (
              <NodeCard key={node.nodeId} node={node} />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
