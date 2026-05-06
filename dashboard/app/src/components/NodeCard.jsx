import React from 'react';
import { ShieldAlert, Zap, Cpu } from 'lucide-react';

const ChannelTelemetry = ({ ch, isAlert }) => {
  const currentKv = ch.current_kv || 0;
  const targetKv = ch.target_kv || 0;
  const limitKv = ch.limit_kv || 2.5;
  const pct = Math.min((currentKv / limitKv) * 100, 100);

  return (
    <div className="mb-6">
      <div className="flex justify-between items-end mb-2">
        <div className="flex flex-col">
          <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">
            Channel {ch.ch}
          </span>
          <span className="text-[7px] text-gray-400 font-bold uppercase tracking-widest">
             {targetKv > 0 ? `Target: ${targetKv.toFixed(3)} kV` : 'No Target Set'}
          </span>
        </div>
        <span className={`text-3xl font-black tracking-tighter ${isAlert ? 'text-[#be2c2e]' : 'text-[#1d1d1b]'}`}>
          {currentKv.toFixed(3)} <span className="text-xs">kV</span>
        </span>
      </div>
      <div className="h-1.5 w-full bg-gray-100 overflow-hidden">
        <div 
          className={`h-full transition-all duration-1000 ${isAlert ? 'bg-[#be2c2e]' : 'bg-[#1d1d1b]'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

const DetectorCard = ({ node }) => {
  const isOnline = node.status === 'online';
  const isAlert = node.alert || (node.status === 'error');
  const channels = Array.isArray(node.channels) ? node.channels : [];

  return (
    <div className={`relative bg-white border ${isAlert ? 'border-[#be2c2e] ring-4 ring-[#be2c2e]/10 shadow-2xl' : 'border-[#e5e5e5] shadow-sm'} transition-all duration-500 overflow-hidden`}>
      {/* Institutional Ribbon */}
      <div className={`h-1.5 w-full ${isOnline ? (isAlert ? 'bg-[#be2c2e]' : 'bg-[#1d1d1b]') : 'bg-gray-200'}`} />
      
      <div className="p-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-10">
          <div className="flex items-center gap-4">
             <div className={`p-2 ${isOnline ? 'bg-[#1d1d1b] text-white' : 'bg-gray-100 text-gray-400'}`}>
                <Cpu className="w-5 h-5" />
             </div>
             <div>
                <h3 className="text-xl font-black text-[#1d1d1b] tracking-tighter uppercase leading-none">
                  {node.name || `Detector-${String(node.nodeId).padStart(2, '0')}`}
                </h3>
                <p className="text-[9px] uppercase font-bold text-gray-400 tracking-[0.3em] mt-1">PMT Scintillator Unit</p>
             </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-black uppercase tracking-widest ${isOnline ? 'text-emerald-600' : 'text-gray-400'}`}>
              {node.status}
            </span>
            <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse' : 'bg-gray-300'}`} />
          </div>
        </div>

        {/* Channels */}
        <div className="space-y-4">
          {channels.length > 0 ? (
            channels.map(ch => (
              <ChannelTelemetry key={ch.ch} ch={ch} isAlert={isAlert} />
            ))
          ) : (
            <div className="h-24 flex items-center justify-center border-2 border-dashed border-gray-100">
               <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Telemetry Offline</span>
            </div>
          )}
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-2 gap-8 mt-10 pt-8 border-t border-gray-100">
          <div className="space-y-1">
            <p className="text-[8px] uppercase font-black text-gray-400 tracking-widest">Efficiency</p>
            <p className="text-lg font-black text-[#1d1d1b]">
              {isOnline ? '99.4%' : '--'} <span className="text-[10px]">Q.E.</span>
            </p>
          </div>
          <div className="space-y-1 text-right">
            <p className="text-[8px] uppercase font-black text-gray-400 tracking-widest">Thermal Load</p>
            <p className="text-lg font-black text-[#1d1d1b]">
              {node.power?.w ? node.power.w.toFixed(1) : '0.0'} <span className="text-[10px]">W</span>
            </p>
          </div>
        </div>
      </div>

      {/* Alert Overlay */}
      {isAlert && (
        <div className="absolute top-4 right-4">
          <ShieldAlert className="text-[#be2c2e] w-10 h-10 animate-bounce" />
        </div>
      )}
    </div>
  );
};

export default DetectorCard;
