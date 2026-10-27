import React from 'react';

export default function Header({ backendHealth }) {
  const isOnline = backendHealth?.online;
  const hasBinary = backendHealth?.executableExists;

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-4">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <h1 className="text-lg font-bold text-white tracking-tight">
              Smart Delivery Route Optimization
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            College Algorithms Mini-Project • C++17 Core Engine + Express API + Native SVG Map
          </p>
        </div>

        {/* Backend & C++ Binary Status Badge */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">Backend:</span>
          {isOnline ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              API Connected {hasBinary && '• C++ Ready'}
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-semibold text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              Offline (:5001)
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
