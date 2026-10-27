import React from 'react';

export default function RouteControls({
  presets = [],
  selectedPresetId,
  onChangePreset,
  availableCustomerStops = [],
  selectedStopCount,
  onChangeStopCount,
  activeAlgorithm,
  onChangeActiveAlgorithm,
  isLoading,
  onRunNearestNeighbor,
  onRunTwoOpt,
  hasResult,
  isPlaying,
  onTogglePlay,
  simulationProgress,
  onChangeProgress
}) {
  return (
    <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
      {/* 1. Preset Selector & Stop Count Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Sample Preset Dropdown */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
            <span>Sample City Graph Preset</span>
            <span className="text-[10px] text-amber-400 font-normal">Sample Data</span>
          </label>
          <select
            value={selectedPresetId}
            onChange={(e) => onChangePreset(e.target.value)}
            disabled={isLoading}
            className="w-full px-3 py-2 text-xs font-medium bg-slate-800 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-400 transition-colors disabled:opacity-50"
          >
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </div>

        {/* Customer Stop Count Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
            <span>Customer Stop Count</span>
            <span className="text-xs font-mono text-cyan-400 font-bold">
              {selectedStopCount} stops
            </span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={2}
              max={availableCustomerStops.length || 5}
              value={selectedStopCount}
              onChange={(e) => onChangeStopCount(parseInt(e.target.value, 10))}
              disabled={isLoading}
              className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 disabled:opacity-50"
            />
            <span className="text-xs font-medium text-slate-400 min-w-[3rem] text-right">
              2 - {availableCustomerStops.length}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Action Buttons: Nearest Neighbor & Run 2-Opt */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
        <button
          onClick={onRunNearestNeighbor}
          disabled={isLoading}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 text-slate-100 font-bold text-xs shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {isLoading && activeAlgorithm === 'nearest_neighbor' ? (
            <span className="inline-block w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-slate-400" />
          )}
          Compute Nearest Neighbor
        </button>

        <button
          onClick={onRunTwoOpt}
          disabled={isLoading}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-cyan-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {isLoading && activeAlgorithm === 'two_opt' ? (
            <span className="inline-block w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-slate-950" />
          )}
          Run 2-Opt Optimization
        </button>
      </div>

      {/* 3. Route Display Controls & Simulation Slider */}
      {hasResult && (
        <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
          {/* Active Route View Switcher */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-semibold text-[11px]">Display Route:</span>
            <div className="inline-flex rounded-lg bg-slate-800 p-0.5 border border-slate-700">
              <button
                onClick={() => onChangeActiveAlgorithm('nearest_neighbor')}
                className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
                  activeAlgorithm === 'nearest_neighbor'
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Nearest Neighbor
              </button>
              <button
                onClick={() => onChangeActiveAlgorithm('two_opt')}
                className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
                  activeAlgorithm === 'two_opt'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                2-Opt Optimized
              </button>
            </div>
          </div>

          {/* Vehicle Simulation Play / Scrub Slider */}
          <div className="flex items-center gap-2.5 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-750">
            <button
              onClick={onTogglePlay}
              className="p-1 rounded-md bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition-colors"
              title={isPlaying ? 'Pause' : 'Play Simulation'}
            >
              {isPlaying ? (
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              )}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(simulationProgress * 100)}
              onChange={(e) => onChangeProgress(parseInt(e.target.value, 10) / 100)}
              className="w-24 sm:w-32 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <span className="font-mono text-[10px] text-slate-400 w-8">
              {Math.round(simulationProgress * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
