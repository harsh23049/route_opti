const ghostBtn =
  'h-11 min-w-[44px] rounded-lg px-3 text-[13px] font-medium text-[#374151] hover:bg-[#F3F4F6] disabled:cursor-not-allowed disabled:text-[#C0C4CC] disabled:hover:bg-transparent';

const VAN_CHOICES = [1, 2, 3, 4, 5];

export default function RouteControls({
  presets, selectedPresetId, onChangePreset, presetLoading, selectedStopCount, onResetStops, onClearStops,
  vehicles, onChangeVehicles, isLoading, onOptimize, backendHealth, addingStop, onToggleAddStop
}) {
  const noStops = selectedStopCount === 0;
  const offline = backendHealth?.checked && !backendHealth?.online;
  const status = !backendHealth?.checked ? 'Checking engine…' : offline ? 'Engine offline' : 'Engine ready';
  const hint = offline
    ? 'Backend offline: run cd backend && npm start'
    : presetLoading
      ? 'Loading the road network…'
      : isLoading
        ? 'Map locked while optimizing.'
        : addingStop
          ? 'Click the map to drop a stop. Click a new stop again to remove it.'
          : noStops
            ? 'Select at least 1 stop on the map, or add your own.'
            : vehicles > selectedStopCount
              ? `Only ${selectedStopCount} ${selectedStopCount === 1 ? 'van is' : 'vans are'} needed for ${selectedStopCount} ${selectedStopCount === 1 ? 'stop' : 'stops'}.`
              : '';

  return (
    <div className="px-6 pb-5 pt-5">
      <div className="flex items-baseline justify-between">
        <h1 className="text-[16px] font-semibold tracking-[-0.01em] text-[#111827]">Route planner</h1>
        <span className={`text-[12px] ${offline ? 'text-[#B42318]' : 'text-[#6B7280]'}`}>{status}</span>
      </div>

      <label htmlFor="preset" className="mt-5 block text-[12px] font-medium text-[#6B7280]">City area</label>
      <select
        id="preset"
        value={selectedPresetId}
        onChange={(e) => onChangePreset(e.target.value)}
        disabled={isLoading}
        className="mt-1.5 h-11 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-[14px] text-[#111827] shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:border-[#D1D5DB] disabled:opacity-50"
      >
        {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      <div className="mt-3 flex items-center justify-between">
        <span className="tnum text-[14px] text-[#111827]">
          {selectedStopCount} {selectedStopCount === 1 ? 'stop' : 'stops'}
          <span className="text-[#9CA3AF]"> selected</span>
        </span>
        <div className="-mr-3 flex items-center">
          <button
            type="button"
            className={`${ghostBtn} ${addingStop ? 'bg-[#EEF2FF] text-[#4338CA] hover:bg-[#E0E7FF]' : ''}`}
            onClick={onToggleAddStop}
            disabled={isLoading || presetLoading}
            aria-pressed={addingStop}
          >
            {addingStop ? 'Done' : '+ Add stop'}
          </button>
          <button type="button" className={ghostBtn} onClick={onResetStops} disabled={isLoading || presetLoading}>Reset</button>
          <button type="button" className={ghostBtn} onClick={onClearStops} disabled={isLoading || noStops}>Clear</button>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <span id="vans-label" className="text-[13px] text-[#374151]">Delivery vans</span>
        <div role="radiogroup" aria-labelledby="vans-label" className="flex rounded-lg bg-[#F3F4F6] p-0.5">
          {VAN_CHOICES.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={vehicles === n}
              onClick={() => onChangeVehicles(n)}
              disabled={isLoading}
              className={`tnum h-9 w-9 rounded-md text-[13px] font-medium ${
                vehicles === n ? 'bg-white text-[#111827] shadow-[0_1px_2px_rgba(16,24,40,0.12)]' : 'text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onOptimize}
        disabled={isLoading || noStops || presetLoading}
        className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#4F46E5] text-[14px] font-semibold text-white shadow-[0_1px_2px_rgba(16,24,40,0.12)] hover:bg-[#4338CA] disabled:cursor-not-allowed disabled:bg-[#EEF0F3] disabled:text-[#9CA3AF] disabled:shadow-none"
      >
        {isLoading && (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
            <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
        {isLoading ? 'Optimizing…' : vehicles > 1 ? `Optimize ${vehicles} van routes` : 'Optimize Route'}
      </button>
      <p className="mt-2 min-h-[18px] text-[12px] text-[#6B7280]" aria-live="polite">{hint}</p>
    </div>
  );
}
