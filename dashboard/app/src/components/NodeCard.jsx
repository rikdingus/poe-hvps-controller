import React from 'react';
import { ShieldAlert, Zap, Info } from 'lucide-react';

const NodeCard = ({ node }) => {
  const calculatePct = (kv) => {
    const min = 0.5;
    const max = 3.0;
    return Math.max(0, Math.min(100, ((kv - min) / (max - min)) * 100));
  };

  const pct = calculatePct(node.channels[0].current_kv);
  const isCritical = node.alert || node.channels[0].current_kv > 2.8;

  return (
    <div className={`bg-white border border-[#e5e5e5] transition-all duration-300 flex flex-col group ${isCritical ? 'border-[#be2c2e] border-2 ring-4 ring-[#be2c2e]/5' : 'hover:border-[#be2c2e]'}`}>
      {/* Node Header */}
      <div className="bg-white px-8 py-6 border-b border-[#e5e5e5] flex justify-between items-center">
        <div>
          <span className="text-[9px] uppercase font-black text-gray-400 tracking-[0.2em] block mb-1">Laboratory Unit</span>
          <h3 className="text-2xl font-black text-[#1d1d1b]">
            UNIT-{node.nodeId.toString().padStart(2, '0')}
          </h3>
        </div>
        <div className="flex flex-col items-end">
           <span className={`text-[10px] font-black uppercase tracking-tighter mb-1 ${node.status === 'online' ? 'text-emerald-600' : 'text-gray-300'}`}>
             {node.status}
           </span>
           <div className={`w-3 h-3 ${node.status === 'online' ? (isCritical ? 'bg-[#be2c2e] animate-pulse' : 'bg-emerald-500') : 'bg-gray-200'}`}></div>
        </div>
      </div>

      {/* Main Readout */}
      <div className="p-10 flex flex-col items-center justify-center bg-[#fafafa]">
        <div className="relative mb-6">
           <div className={`text-8xl font-black tracking-tighter leading-none ${isCritical ? 'text-[#be2c2e]' : 'text-[#1d1d1b]'}`}>
             {node.channels[0].current_kv.toFixed(2)}
           </div>
           <span className="absolute -right-12 bottom-1 text-2xl font-bold text-[#be2c2e]">kV</span>
        </div>
        
        {/* Progress Bar (Radboud Style) */}
        <div className="w-full h-3 bg-gray-200 mb-2">
           <div 
             className={`h-full transition-all duration-500 ${isCritical ? 'bg-[#be2c2e]' : 'bg-[#1d1d1b]'}`}
             style={{ width: `${pct}%` }}
           />
        </div>
        <div className="flex justify-between w-full text-[9px] uppercase font-black text-gray-400 tracking-widest">
          <span>0.50 kV</span>
          <span>3.00 kV</span>
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="p-8 grid grid-cols-2 gap-8 border-t border-[#e5e5e5]">
        <div>
          <p className="text-[9px] uppercase font-black text-gray-400 mb-2 tracking-widest">Power Load</p>
          <p className="text-xl font-black">{node.power.w.toFixed(1)} <span className="text-xs text-gray-300">W</span></p>
        </div>
        <div className="text-right">
          <p className="text-[9px] uppercase font-black text-gray-400 mb-2 tracking-widest">PoE Source</p>
          <p className="text-xl font-black">{node.power.v.toFixed(1)} <span className="text-xs text-gray-300">V</span></p>
        </div>
      </div>

      {/* Fault Indicator / RU Footer */}
      <div className={`px-8 py-4 flex items-center justify-between transition-colors ${isCritical ? 'bg-[#be2c2e] text-white' : 'bg-white group-hover:bg-[#f8f9fa]'}`}>
         <div className="flex items-center gap-2">
           {isCritical && <ShieldAlert className="w-4 h-4" />}
           <span className={`text-[10px] font-black uppercase tracking-widest ${isCritical ? 'text-white' : 'text-[#be2c2e]'}`}>
             {isCritical ? 'SAFETY INTERLOCK ACTIVE' : 'DIAGNOSTICS NOMINAL'}
           </span>
         </div>
         <span className={`font-bold transition-transform group-hover:translate-x-1 ${isCritical ? 'text-white' : 'text-[#be2c2e]'}`}>→</span>
      </div>
    </div>
  );
};

export default NodeCard;
