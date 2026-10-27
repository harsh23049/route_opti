const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function Scrubber({ isPlaying, onTogglePlay, simulationProgress, onChangeProgress, totalKm, durationS, className = '' }) {
  const pct = Math.round(simulationProgress * 100);
  const km = (totalKm || 0) * simulationProgress;
  return (
    <div className={`float-card flex w-full max-w-[480px] items-center gap-3 rounded-xl py-1 pl-1 pr-4 ${className}`}>
      <button
        type="button"
        onClick={onTogglePlay}
        aria-label={isPlaying ? 'Pause delivery animation' : 'Play delivery animation'}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#111827] hover:bg-[#F3F4F6]"
      >
        {isPlaying ? (
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="2.5" y="2" width="3" height="10" rx="1" fill="currentColor" /><rect x="8.5" y="2" width="3" height="10" rx="1" fill="currentColor" /></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3.5 2.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L4.4 1.7a.6.6 0 0 0-.9.5Z" fill="currentColor" /></svg>
        )}
      </button>
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        value={pct}
        onChange={(e) => onChangeProgress(Number(e.target.value) / 100)}
        aria-label="Delivery progress"
        className="scrub h-1 min-w-0 flex-1 cursor-pointer"
      />
      <span className="tnum shrink-0 text-right text-[12px] text-[#6B7280]">
        <span className="text-[#111827]">{km.toFixed(2)}</span> / {(totalKm || 0).toFixed(2)} km
        <span className="mx-1.5 text-[#D1D5DB]">|</span>
        {fmtTime(durationS * simulationProgress)} / {fmtTime(durationS)}
        <span className="sr-only"> {pct}%</span>
      </span>
    </div>
  );
}
