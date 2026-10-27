import React from 'react';
import { formatDistance, formatPercentage, formatExecutionTime } from '../utils/formatters';

export default function MetricCards({
  initialDistance,
  optimizedDistance,
  distanceSaved,
  improvementPercent,
  executionTimeMs,
  hasResult = false
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 w-full">
      {/* 1. Initial Distance */}
      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Initial Distance
        </div>
        <div className="text-xl font-bold text-white mt-1">
          {hasResult ? formatDistance(initialDistance) : '—'}
        </div>
        <div className="text-[11px] text-slate-500 mt-0.5">Nearest Neighbor tour</div>
      </div>

      {/* 2. Optimized Distance */}
      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
        <div className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">
          Optimized Distance
        </div>
        <div className="text-xl font-bold text-cyan-300 mt-1">
          {hasResult ? formatDistance(optimizedDistance) : '—'}
        </div>
        <div className="text-[11px] text-slate-500 mt-0.5">2-Opt local search</div>
      </div>

      {/* 3. Distance Saved */}
      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
        <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
          Distance Saved
        </div>
        <div className="text-xl font-bold text-emerald-400 mt-1">
          {hasResult ? formatDistance(distanceSaved) : '—'}
        </div>
        <div className="text-[11px] text-slate-500 mt-0.5">
          {hasResult && distanceSaved > 0 ? 'Untangled crossings' : 'Optimal baseline'}
        </div>
      </div>

      {/* 4. Improvement Percentage */}
      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
        <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
          Improvement
        </div>
        <div className="text-xl font-bold text-amber-300 mt-1">
          {hasResult ? formatPercentage(improvementPercent) : '—'}
        </div>
        <div className="text-[11px] text-slate-500 mt-0.5">Percent cost reduction</div>
      </div>

      {/* 5. C++ Execution Time */}
      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-indigo-500/30 bg-indigo-950/10 shadow-sm col-span-2 sm:col-span-1">
        <div className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider flex items-center justify-between">
          <span>Engine Latency</span>
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono">C++17</span>
        </div>
        <div className="text-xl font-bold font-mono text-indigo-300 mt-1">
          {hasResult ? formatExecutionTime(executionTimeMs) : '—'}
        </div>
        <div className="text-[11px] text-slate-400 font-mono mt-0.5">Compiled binary IPC</div>
      </div>
    </div>
  );
}
