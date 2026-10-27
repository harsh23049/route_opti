import { formatDistance } from '../utils/formatters';
import { ROUTE_VIEWS } from '../utils/routeView';

export default function StopItinerary({ routeView, hasRoute, nodeMap, warehouseId, selectedNodeId, onSelectNode, onHoverNode }) {
  if (!hasRoute) return null;
  const { route: tour, legs, distance, view } = routeView;
  const badge = ROUTE_VIEWS.find((v) => v.id === view)?.badge || 'Optimized';
  // Running total after each leg, computed before render output.
  const totals = [];
  for (let i = 0, sum = 0; i < legs.length; i++) {
    sum += legs[i].distanceKm;
    totals.push(sum);
  }

  return (
    <section className="tnum border-t border-[#F0F1F3] px-6 pb-6 pt-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[14px] font-semibold text-[#111827]">Manifest</h2>
        <span className="text-[12px] text-[#6B7280]">
          <span data-badge>{badge}</span> · {Math.max(tour.length - 2, 0)} stops · {formatDistance(distance)}
        </span>
      </div>
      <div className="mt-3 flex px-2 text-[11.5px] text-[#9CA3AF]">
        <span className="flex-1 pl-8">Stop</span>
        <span className="w-14 text-right">Leg km</span>
        <span className="w-16 text-right">Total km</span>
      </div>
      <ol className="-mx-2 mt-1" onMouseLeave={() => onHoverNode && onHoverNode(null)}>
        {tour.map((stopId, idx) => {
          const node = nodeMap?.get(stopId);
          const isWarehouse = stopId === warehouseId;
          const leg = idx > 0 ? legs[idx - 1] : null;
          const isSelected = selectedNodeId === stopId;
          const title = isWarehouse ? (idx === 0 ? 'Depart depot' : 'Return to depot') : node?.name || stopId;
          return (
            <li key={`it-${stopId}-${idx}`}>
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelectNode && onSelectNode(isSelected ? null : stopId)}
                onMouseEnter={() => onHoverNode && onHoverNode(stopId)}
                onFocus={() => onHoverNode && onHoverNode(stopId)}
                onBlur={() => onHoverNode && onHoverNode(null)}
                className={`flex min-h-[44px] w-full items-center rounded-lg px-2 py-1.5 text-left text-[13px] ${
                  isSelected ? 'bg-[#EEF2FF]' : 'hover:bg-[#F7F7F8]'
                }`}
              >
                <span className="mr-3 flex h-5 w-5 shrink-0 items-center justify-center">
                  {isWarehouse ? (
                    <span className="h-3.5 w-3.5 rounded-[4px] bg-[#111827]" aria-hidden="true" />
                  ) : (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#4F46E5] text-[11px] font-semibold text-white">{idx}</span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate ${isWarehouse ? 'text-[#4B5563]' : 'text-[#111827]'}`}>{title}</span>
                  {leg?.pathNodes && leg.pathNodes.length > 2 && (
                    <span className="block truncate text-[12px] text-[#9CA3AF]">via {leg.pathNodes.slice(1, -1).join(', ')}</span>
                  )}
                </span>
                <span className="w-14 text-right text-[12.5px] text-[#4B5563]">{leg ? leg.distanceKm.toFixed(2) : ''}</span>
                <span className="w-16 text-right text-[12.5px] text-[#111827]">{leg ? totals[idx - 1].toFixed(2) : '0.00'}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
