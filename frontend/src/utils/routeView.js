/**
 * Route view selection helpers. Pure data picking from the backend response,
 * no routing logic lives here.
 */

export const ROUTE_VIEWS = [
  { id: 'nearest_neighbor', label: 'Nearest Neighbor', badge: 'NN' },
  { id: 'optimized', label: 'Optimized (2-Opt + Or-opt)', badge: 'Optimized' },
  { id: 'optimal', label: 'Optimal (Held-Karp)', badge: 'Optimal' }
];

export function hasOptimalRoute(routeData) {
  return Boolean(routeData && Array.isArray(routeData.optimalRoute));
}

/** Falls back to "optimized" when the optimal view is not available. */
export function resolveView(routeData, view) {
  if (view === 'optimal' && !hasOptimalRoute(routeData)) return 'optimized';
  return view;
}

function coordsFromLegs(legs) {
  const out = [];
  (legs || []).forEach((leg, legIdx) => {
    (leg.coordinates || []).forEach((c, i) => {
      if (legIdx > 0 && i === 0) return;
      out.push(c);
    });
  });
  return out;
}

/**
 * Picks { route, legs, coords, distance } for the active view.
 * @returns {{ route: string[], legs: object[], coords: number[][], distance: number|null, view: string }}
 */
export function pickRouteView(routeData, view) {
  if (!routeData) return { route: [], legs: [], coords: [], distance: null, view };
  const v = resolveView(routeData, view);
  let route, legs, coords, distance;
  if (v === 'nearest_neighbor') {
    route = routeData.initialRoute;
    legs = routeData.initialLegs;
    coords = routeData.initialFullCoordinates;
    distance = routeData.initialDistance;
  } else if (v === 'optimal') {
    route = routeData.optimalRoute;
    legs = routeData.optimalLegs;
    coords = routeData.optimalFullCoordinates;
    distance = routeData.optimalDistance;
  } else {
    route = routeData.optimizedRoute;
    legs = routeData.legs;
    coords = routeData.fullCoordinates;
    distance = routeData.optimizedDistance;
  }
  legs = legs || [];
  coords = coords && coords.length ? coords : coordsFromLegs(legs);
  return { route: route || [], legs, coords, distance: distance ?? null, view: v };
}

/** One accent; views differ by line style. */
export const ACCENT = '#4F46E5';
export const LINE_STYLES = {
  nearest_neighbor: { color: '#9CA3AF', casing: null, width: 4, dash: '8 7' },
  optimized: { color: ACCENT, casing: '#3730A3', width: 5, dash: null },
  optimal: { color: '#312E81', casing: '#1E1B4B', width: 5, dash: null }
};
