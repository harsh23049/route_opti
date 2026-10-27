import { LINE_STYLES, ACCENT, VAN_COLORS } from '../utils/routeView';

function Line({ view }) {
  const s = LINE_STYLES[view];
  return (
    <svg width="22" height="8" viewBox="0 0 22 8" aria-hidden="true">
      {s.casing && <line x1="2" y1="4" x2="20" y2="4" stroke={s.casing} strokeWidth="5.5" strokeLinecap="round" />}
      <line x1="2" y1="4" x2="20" y2="4" stroke={s.color} strokeWidth="3" strokeDasharray={s.dash ? '4 3' : undefined} strokeLinecap="round" />
    </svg>
  );
}

function Swatch({ color, dash }) {
  return (
    <svg width="22" height="8" viewBox="0 0 22 8" aria-hidden="true">
      <line x1="2" y1="4" x2="20" y2="4" stroke={color} strokeWidth="3" strokeDasharray={dash} strokeLinecap="round" />
    </svg>
  );
}

/** vans > 0 lists one colour per van instead of the single-route line styles. */
export default function Legend({ className = '', vans = 0, showBefore = false }) {
  const row = 'flex items-center gap-2.5';
  return (
    <div className={`float-card rounded-xl px-3.5 py-3 text-[12px] text-[#374151] ${className}`} aria-label="Map legend">
      <div className="flex flex-col gap-2">
        <div className={row}>
          <span className="flex w-[22px] justify-center"><span className="h-3.5 w-3.5 rounded-[4px] bg-[#111827]" /></span>Depot
        </div>
        <div className={row}>
          <span className="flex w-[22px] justify-center"><span className="h-3.5 w-3.5 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" style={{ background: ACCENT }} /></span>Stop
        </div>
        <div className={row}>
          <span className="flex w-[22px] justify-center"><span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-[#9CA3AF] bg-white" /></span>Location
        </div>
        {vans > 0 ? (
          VAN_COLORS.slice(0, vans).map((c, i) => (
            <div key={c} className={row}><Swatch color={c} />Van {i + 1}</div>
          ))
        ) : (
          <>
            <div className={row}><Line view="nearest_neighbor" />Nearest Neighbor</div>
            <div className={row}><Line view="optimized" />Optimized</div>
            <div className={row}><Line view="optimal" />Optimal</div>
          </>
        )}
        {showBefore && (
          <div className={row}><Swatch color="#4B5563" dash="1 4" />Before</div>
        )}
      </div>
    </div>
  );
}
