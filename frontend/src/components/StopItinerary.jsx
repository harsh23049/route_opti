import { formatDistance } from '../utils/formatters';
import { ROUTE_VIEWS } from '../utils/routeView';

// Street names along a leg, consecutive repeats collapsed: "via Janpath, Outer Circle".
function streetsOf(pathNodes, roadNames) {
  const out = [];
  for (let i = 1; i < (pathNodes || []).length; i++) {
    const name = roadNames?.get(`${pathNodes[i - 1]}|${pathNodes[i]}`);
    if (name && out[out.length - 1] !== name) out.push(name);
  }
  return out;
}

function RouteStops({ route, title, color, nodeMap, roadNames, warehouseId, selectedNodeId, onSelectNode, onHoverNode }) {
  const { route: tour, legs, distance } = route;
  // Running total after each leg, computed before render output.
  const totals = [];
  for (let i = 0, sum = 0; i < legs.length; i++) {
    sum += legs[i].distanceKm;
    totals.push(sum);
  }

  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold text-[#111827]">
          {color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} aria-hidden="true" />}
          {title}
        </h3>
        <span className="text-[12px] text-[#6B7280]">
          {Math.max(tour.length - 2, 0)} stops · {formatDistance(distance)}
        </span>
      </div>
      <div className="mt-2 flex px-2 text-[11.5px] text-[#9CA3AF]">
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
          const label = isWarehouse ? (idx === 0 ? 'Depart depot' : 'Return to depot') : node?.name || stopId;
          const via = streetsOf(leg?.pathNodes, roadNames);
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
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                      style={{ background: color || '#4F46E5' }}
                    >
                      {idx}
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate ${isWarehouse ? 'text-[#4B5563]' : 'text-[#111827]'}`}>{label}</span>
                  {via.length > 0 && <span className="block truncate text-[12px] text-[#9CA3AF]">via {via.join(', ')}</span>}
                </span>
                <span className="w-14 text-right text-[12.5px] text-[#4B5563]">{leg ? leg.distanceKm.toFixed(2) : ''}</span>
                <span className="w-16 text-right text-[12.5px] text-[#111827]">{leg ? totals[idx - 1].toFixed(2) : '0.00'}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function StopItinerary({ routeView, hasRoute, nodeMap, roadNames, warehouseId, selectedNodeId, onSelectNode, onHoverNode }) {
  if (!hasRoute) return null;
  const { routes, fleet, view } = routeView;
  const viewInfo = ROUTE_VIEWS.find((v) => v.id === view);
  const badge = (fleet ? viewInfo?.fleetLabel : viewInfo?.badge) || 'Optimized';
  const shared = { nodeMap, roadNames, warehouseId, selectedNodeId, onSelectNode, onHoverNode };

  return (
    <section className="tnum border-t border-[#F0F1F3] px-6 pb-6 pt-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[14px] font-semibold text-[#111827]">Manifest</h2>
        <span className="text-[12px] text-[#6B7280]" data-badge>{badge}</span>
      </div>
      {routes.map((r, i) => (
        <RouteStops
          key={`route-${r.vehicle ?? i}`}
          route={r}
          title={fleet ? `Van ${r.vehicle}` : 'Route'}
          color={fleet ? r.color : null}
          {...shared}
        />
      ))}
    </section>
  );
}
