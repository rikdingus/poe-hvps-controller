import React, { useState, useEffect } from 'react';
import { Activity, ShieldCheck, Zap, Power, AlertTriangle, Settings, RefreshCcw, Gauge } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

const QuotaWidget = ({ credits }) => {
  if (!credits) return null;
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
      <h3 className="text-[10px] uppercase text-white/40 mb-3 flex items-center gap-2">
        <Gauge className="w-3 h-3" /> AI Fuel Status
      </h3>
      <div className="space-y-4">
        {Object.entries(credits.models).map(([key, model]) => (
          <div key={key}>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-white/60">{model.display_name}</span>
              <span className={model.status === 'DEPLETED' ? 'text-red-400' : 'text-emerald-400'}>
                {model.status}
              </span>
            </div>
            <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ${model.status === 'DEPLETED' ? 'bg-red-500' : 'bg-emerald-500'}`}
                style={{ width: `${(model.credits_remaining / model.total_budget) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const NodeCard = ({ node }) => {
  const isOnline = node.status === 'online';
  const data = node.data;
  const isRamping = data && (data.p1 !== data.c1 || data.p2 !== data.c2);

  return (
    <div className={`relative rounded-2xl border backdrop-blur-xl p-5 transition-all ${isOnline ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-red-500/5 border-red-500/20'}`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-medium text-white/90">{node.name}</h3>
          <p className="text-xs text-white/40">{node.location} • {node.ip}</p>
        </div>
        <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
          {node.status}
        </div>
      </div>

      {isOnline && data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-black/20 rounded-lg p-3 border border-white/5">
              <p className="text-[10px] text-white/40 uppercase mb-1">HV Output 1</p>
              <p className="text-xl font-bold text-accent">{Math.round(data.hv1 * data.hv1g + data.hv1o)}V</p>
            </div>
            <div className="bg-black/20 rounded-lg p-3 border border-white/5">
              <p className="text-[10px] text-white/40 uppercase mb-1">HV Output 2</p>
              <p className="text-xl font-bold text-accent">{Math.round(data.hv2 * data.hv2g + data.hv2o)}V</p>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-white/60 pt-2 border-t border-white/5">
            <div className="flex items-center gap-2">
              <Zap className="w-3 h-3 text-secondary" />
              <span>{data.v.toFixed(1)}V @ {data.i.toFixed(2)}A</span>
            </div>
            {isRamping && (
              <div className="flex items-center gap-1 text-secondary animate-pulse">
                <RefreshCcw className="w-3 h-3" />
                <span>Ramping...</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="h-32 flex flex-col items-center justify-center text-white/20 gap-2">
          <AlertTriangle className="w-8 h-8 opacity-20" />
          <span className="text-[10px] uppercase">Connection Lost</span>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [nodes, setNodes] = useState([]);
  const [credits, setCredits] = useState(null);
  
  const fetchData = async () => {
    try {
      const [nodesRes, creditsRes] = await Promise.all([
        fetch('/api/nodes'),
        fetch('/api/credits')
      ]);
      setNodes(await nodesRes.json());
      setCredits(await creditsRes.json());
    } catch (e) {
      console.error('Fetch Error:', e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background text-white p-8">
      <div className="max-w-[1600px] mx-auto grid grid-cols-12 gap-8">
        
        {/* Sidebar */}
        <aside className="col-span-3">
          <div className="flex items-center gap-4 mb-12">
            <div className="p-3 rounded-2xl bg-accent/20 border border-accent/20">
              <Activity className="w-8 h-8 text-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-light tracking-tight">Research Station <span className="font-bold text-accent">Alpha</span></h1>
              <p className="text-white/40 text-[10px] uppercase tracking-widest">HVPS Management Center</p>
            </div>
          </div>

          <QuotaWidget credits={credits} />

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-[10px] uppercase text-white/40 mb-4 flex items-center gap-2">
              <ShieldCheck className="w-3 h-3 text-emerald-400" /> Security Status
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-white/60">WireGuard</span>
                <span className="text-[10px] font-bold text-emerald-400 uppercase">Active</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-white/60">HA Bridge</span>
                <span className="text-[10px] font-bold text-emerald-400 uppercase">Connected</span>
              </div>
            </div>
            <button className="w-full mt-6 py-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-bold uppercase hover:bg-red-500/30 transition-all flex items-center justify-center gap-2">
              <Power className="w-4 h-4" /> Global Emergency Stop
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="col-span-9">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {nodes.map(node => (
              <NodeCard key={node.id} node={node} />
            ))}
          </div>

          <footer className="mt-12 grid grid-cols-3 gap-6 p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md">
            <div className="flex items-center gap-4">
              <Zap className="w-6 h-6 text-white/40" />
              <div>
                <p className="text-[10px] uppercase text-white/40">Active Nodes</p>
                <p className="text-xl font-bold">{nodes.filter(n => n.status === 'online').length} / {nodes.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 border-l border-white/10 pl-6">
              <Activity className="w-6 h-6 text-white/40" />
              <div>
                <p className="text-[10px] uppercase text-white/40">Last System Sync</p>
                <p className="text-xl font-bold">Just Now</p>
              </div>
            </div>
            <div className="flex items-center gap-4 border-l border-white/10 pl-6">
              <Settings className="w-6 h-6 text-white/40 animate-spin-slow" />
              <div>
                <p className="text-[10px] uppercase text-white/40">SysAdmin Console</p>
                <button className="text-xs text-accent hover:underline">Open Terminal</button>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
