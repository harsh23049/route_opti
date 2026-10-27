import { formatDistance, formatPercentage, formatExecutionTime } from '../utils/formatters';
import { ROUTE_VIEWS, LINE_STYLES, hasOptimalRoute } from '../utils/routeView';

function LineSwatch({ view }) {
  const s = LINE_STYLES[view];
  return (
    <svg width="28" height="10" viewBox="0 0 28 10" aria-hidden="true" className="shrink-0">
      {s.casing && <line x1="3" y1="5" x2="25" y2="5" stroke={s.casing} strokeWidth="6" strokeLinecap="round" />}
      <line x1="3" y1="5" x2="25" y2="5" stroke={s.color} strokeWidth={s.casing ? 3.5 : 3} strokeDasharray={s.dash ? '5 4' : undefined} strokeLinecap="round" />
    </svg>
  );
}

function Skeleton() {
  return (
    <div className="px-6 py-6" aria-busy="true" aria-label="Loading results">
      <div className="skeleton h-3 w-28" />
      <div className="skeleton mt-3 h-8 w-40" />
      <div className="skeleton mt-3 h-3 w-full" />
      <div className="mt-6 space-y-3">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-3" style={{ width: `${92 - i * 12}%` }} />)}
      </div>
    </div>
  );
}

export default function MetricCards({ routeData, isLoading, activeView, onChangeView }) {
  if (isLoading) return <Skeleton />;
  if (!routeData) {
    return (
      <div className="px-6 py-8 text-center">
        <svg className="mx-auto" width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <rect x="0.5" y="0.5" width="39" height="39" rx="10" fill="#F5F5FF" stroke="#E0E7FF" />
          <path d="M12 27c3-8 13-6 16-14" stroke="#4F46E5" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="3 3" />
          <circle cx="12" cy="27" r="2.5" fill="#4F46E5" />
          <circle cx="28" cy="13" r="2.5" fill="#111827" />
        </svg>
        <h2 className="mt-3 text-[14px] font-semibold text-[#111827]">No route yet</h2>
        <p className="mx-auto mt-1 max-w-[260px] text-[13px] leading-relaxed text-[#6B7280]">
          Select stops on the map, then Optimize. You will see Nearest Neighbor, 2-Opt + Or-opt and the Held-Karp optimum side by side.
        </p>
      </div>
    );
  }

  const { initialDistance, optimizedDistance, distanceSaved, improvementPercent, executionTimeMs, optimalDistance, optimalityGapPercent, stages } = routeData;
  const hasOptimal = optimalDistance !== null && optimalDistance !== undefined;
  const sentence = `${formatDistance(distanceSaved)} shorter than Nearest Neighbor (${formatPercentage(improvementPercent)})${
    hasOptimal ? `, ${formatPercentage(optimalityGapPercent)} above the exact optimum.` : '.'
  }`;
  const views = ROUTE_VIEWS.filter((v) => v.id !== 'optimal' || hasOptimalRoute(routeData));
  const viewDistance = { nearest_neighbor: initialDistance, optimized: optimizedDistance, optimal: optimalDistance };

  const shortName = { 'Nearest Neighbor': 'NN' };
  const bars = [
    ...(stages || []).map((s, i) => ({ label: shortName[s.algorithm] || s.algorithm, km: s.distanceKm, color: ['#D1D5DB', '#A5B4FC', '#4F46E5'][i] || '#4F46E5' })),
    ...(hasOptimal ? [{ label: 'Optimal', km: optimalDistance, color: '#312E81' }] : [])
  ];
  const max = Math.max(...bars.map((b) => b.km), 0.001);

  return (
    <div className="tnum">
      <section className="px-6 py-5">
        <div className="text-[12px] font-medium text-[#6B7280]">Optimized distance</div>
        <div className="mt-1 flex items-center gap-2.5">
          <span className="text-[30px] font-semibold leading-none tracking-[-0.02em] text-[#111827]">{formatDistance(optimizedDistance)}</span>
          <span className="rounded-md bg-[#ECFDF3] px-1.5 py-0.5 text-[12px] font-medium text-[#067647]" title="Saved vs Nearest Neighbor">
            −{formatDistance(distanceSaved)} · {formatPercentage(improvementPercent)}
          </span>
        </div>
        <p className="mt-2 text-[13px] leading-snug text-[#4B5563]">{sentence}</p>
      </section>

      <section className="border-t border-[#F0F1F3] px-6 py-4">
        <h2 className="text-[12px] font-medium text-[#6B7280]">Route on map</h2>
        <div role="group" aria-label="Route view" className="mt-2 -mx-2">
          {views.map((v) => {
            const active = v.id === activeView;
            return (
              <button
                key={v.id}
                type="button"
                aria-pressed={active}
                onClick={() => onChangeView(v.id)}
                className={`flex h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-[13px] ${
                  active ? 'bg-[#EEF2FF] font-medium text-[#111827]' : 'text-[#374151] hover:bg-[#F7F7F8]'
                }`}
              >
                <LineSwatch view={v.id} />
                <span className="flex-1">{v.label}</span>
                <span className="text-[12px] text-[#6B7280]">{formatDistance(viewDistance[v.id])}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="border-t border-[#F0F1F3] px-6 py-4">
        <h2 className="text-[12px] font-medium text-[#6B7280]">Stages</h2>
        <ul className="mt-3 space-y-2.5">
          {bars.map((b) => (
            <li key={b.label} className="flex items-center gap-3 text-[12px]">
              <span className="w-12 shrink-0 text-[#374151]">{b.label}</span>
              <span className="relative h-1.5 flex-1 overflow-hidden rounded-sm bg-[#F3F4F6]">
                <span className="bar absolute inset-y-0 left-0 rounded-sm" style={{ width: `${(b.km / max) * 100}%`, background: b.color }} />
              </span>
              <span className="w-16 shrink-0 text-right text-[#111827]">{formatDistance(b.km)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 text-[13px]">
          <div className="flex items-start justify-between gap-4">
            <dt>
              <span className="text-[#111827]">Optimality gap</span>
              <span className="block text-[12px] text-[#6B7280]">{hasOptimal ? 'vs Held-Karp exact' : 'exact solver only for ≤ 15 stops'}</span>
            </dt>
            <dd className="font-medium text-[#111827]">{hasOptimal ? formatPercentage(optimalityGapPercent) : '—'}</dd>
          </div>
          <div className="flex justify-between gap-4 text-[12px] text-[#6B7280]">
            <dt>Engine time</dt>
            <dd>{formatExecutionTime(executionTimeMs)}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
