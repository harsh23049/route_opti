import React, { useState, useEffect } from 'react';

export default function App() {
  const [backendStatus, setBackendStatus] = useState('checking');
  const [backendMeta, setBackendMeta] = useState(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setBackendStatus('connected');
        setBackendMeta(data);
      })
      .catch(() => {
        setBackendStatus('disconnected');
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h1 className="text-lg font-bold text-white tracking-tight">
              Smart Delivery Route Optimization
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            College Algorithms Mini-Project • C++17 Engine + Express + React + SVG
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Backend API:</span>
          {backendStatus === 'connected' && (
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium border border-emerald-500/30">
              Online
            </span>
          )}
          {backendStatus === 'checking' && (
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium border border-amber-500/30">
              Checking...
            </span>
          )}
          {backendStatus === 'disconnected' && (
            <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-medium border border-rose-500/30">
              Offline (Start backend on :5001)
            </span>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-6 max-w-6xl w-full mx-auto space-y-6">
        {/* System Architecture Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              Core Engine
            </div>
            <div className="text-base font-bold text-white mt-1">C++17 Algorithms</div>
            <p className="text-xs text-slate-400 mt-1">
              Dijkstra shortest path, Nearest Neighbor heuristic, 2-Opt optimization.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
              API Bridge
            </div>
            <div className="text-base font-bold text-white mt-1">Node.js + Express</div>
            <p className="text-xs text-slate-400 mt-1">
              Validates route payloads and bridges request execution to C++ engine.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
              User Interface
            </div>
            <div className="text-base font-bold text-white mt-1">React + Tailwind</div>
            <p className="text-xs text-slate-400 mt-1">
              Interactive dashboard with algorithm controls and real-time metrics.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
              Simulation Map
            </div>
            <div className="text-base font-bold text-white mt-1">Native SVG Canvas</div>
            <p className="text-xs text-slate-400 mt-1">
              Simulated city grid and road network without external cloud map APIs.
            </p>
          </div>
        </section>

        {/* Simulated Map Placeholder Canvas */}
        <section className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Simulated City Road Map Canvas</h2>
            <span className="text-xs text-slate-400">Pure SVG • No external map dependencies</span>
          </div>

          <div className="w-full h-80 rounded-xl bg-slate-950 border border-slate-800 relative overflow-hidden flex items-center justify-center">
            {/* SVG Grid Background Preview */}
            <svg className="w-full h-full" viewBox="0 0 600 300">
              <defs>
                <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#1e293b" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />

              {/* Sample Road Segments */}
              <line x1="80" y1="60" x2="280" y2="60" stroke="#334155" strokeWidth="4" strokeLinecap="round" />
              <line x1="280" y1="60" x2="480" y2="60" stroke="#334155" strokeWidth="4" strokeLinecap="round" />
              <line x1="80" y1="60" x2="80" y2="220" stroke="#334155" strokeWidth="4" strokeLinecap="round" />
              <line x1="280" y1="60" x2="280" y2="220" stroke="#334155" strokeWidth="4" strokeLinecap="round" />
              <line x1="480" y1="60" x2="480" y2="220" stroke="#334155" strokeWidth="4" strokeLinecap="round" />
              <line x1="80" y1="220" x2="480" y2="220" stroke="#334155" strokeWidth="4" strokeLinecap="round" />

              {/* Sample Nodes */}
              <circle cx="80" cy="60" r="7" fill="#f59e0b" />
              <text x="80" y="45" fill="#f59e0b" fontSize="10" fontWeight="bold" textAnchor="middle">Depot</text>

              <circle cx="280" cy="60" r="5" fill="#10b981" />
              <circle cx="480" cy="60" r="5" fill="#10b981" />
              <circle cx="280" cy="220" r="5" fill="#10b981" />
              <circle cx="480" cy="220" r="5" fill="#10b981" />
              <circle cx="80" cy="220" r="5" fill="#10b981" />
            </svg>

            <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] flex flex-col items-center justify-center p-4 text-center pointer-events-none">
              <span className="px-3 py-1 rounded-full bg-slate-800/90 border border-slate-700 text-xs font-semibold text-slate-300">
                Monorepo Scaffolding Complete
              </span>
              <p className="text-xs text-slate-400 mt-2 max-w-md">
                Frontend, backend, and C++ algorithm builds configured. Ready for algorithm and visualization implementation.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-6 py-3 text-center text-xs text-slate-500">
        Smart Delivery Route Optimization • College Mini-Project • C++17 / Express / React / Tailwind
      </footer>
    </div>
  );
}
