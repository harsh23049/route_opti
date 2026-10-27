/**
 * Route view selection helpers. Pure data picking from the backend response,
 * no routing logic lives here.
 *
 * One van: Nearest Neighbor (before), Optimized and the Held-Karp optimum.
 * Several vans: the Nearest Neighbor tour cut into equal chunks (before) and the optimized plan.
 */

export const ROUTE_VIEWS = [
  { id: 'nearest_neighbor', label: 'Nearest Neighbor', fleetLabel: 'Before: greedy, equal split', badge: 'NN' },
  { id: 'optimized', label: 'Optimized (2-Opt + Or-opt)', fleetLabel: 'Optimized split', badge: 'Optimized' },
  { id: 'optimal', label: 'Optimal (Held-Karp)', badge: 'Optimal' }
];

/** One accent; single-van views differ by line style. */
export const ACCENT = '#4F46E5';
export const LINE_STYLES = {
  nearest_neighbor: { color: '#9CA3AF', casing: null, width: 4, dash: '8 7' },
  optimized: { color: ACCENT, casing: '#3730A3', width: 5, dash: null },
  optimal: { color: '#312E81', casing: '#1E1B4B', width: 5, dash: null }
};

/** One colour per van, distinct on a light basemap. */
export const VAN_COLORS = ['#4F46E5', '#0D9488', '#D97706', '#DB2777', '#2563EB', '#65A30D', '#7C3AED', '#DC2626', '#0891B2', '#B45309'];

export const isFleet = (routeData) => Boolean(routeData?.fleet);

export function hasOptimalRoute(routeData) {
  return Boolean(routeData && !isFleet(routeData) && Array.isArray(routeData.optimalRoute));
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

function singleRoute(routeData, view) {
  const pick = {
    nearest_neighbor: ['initialRoute', 'initialLegs', 'initialFullCoordinates', 'initialDistance'],
    optimized: ['optimizedRoute', 'legs', 'fullCoordinates', 'optimizedDistance'],
    optimal: ['optimalRoute', 'optimalLegs', 'optimalFullCoordinates', 'optimalDistance']
  }[view];
  const [route, legs, coords, distance] = pick.map((k) => routeData[k]);
  return { route, legs, coords, distance };
}

function toView(r, style, vehicle) {
  const legs = r.legs || [];
  return {
    vehicle,
    route: r.route || [],
    legs,
    coords: r.coords && r.coords.length ? r.coords : coordsFromLegs(legs),
    distance: r.distance ?? null,
    ...style
  };
}

/**
 * Picks the routes to draw for the active view.
 * @returns {{ view: string, fleet: boolean, routes: object[], distance: number|null }}
 *   routes: [{ vehicle, route, legs, coords, distance, color, casing, width, dash }];
 *   distance: the route length, or the longest van route for a fleet.
 */
export function pickRouteView(routeData, view) {
  if (!routeData) return { view, fleet: false, routes: [], distance: null };
  const v = resolveView(routeData, view);
  if (isFleet(routeData)) {
    const plan = v === 'nearest_neighbor' ? routeData.fleet.baseline : routeData.fleet.optimized;
    const routes = plan.routes.map((r, i) =>
      toView(
        { route: r.route, legs: r.legs, coords: r.fullCoordinates, distance: r.distance },
        {
          color: VAN_COLORS[i % VAN_COLORS.length],
          casing: '#FFFFFF',
          width: 5,
          dash: v === 'nearest_neighbor' ? '8 7' : null
        },
        r.vehicle
      )
    );
    return { view: v, fleet: true, routes, distance: plan.longestRoute };
  }
  const r = singleRoute(routeData, v);
  return { view: v, fleet: false, routes: [toView(r, LINE_STYLES[v], null)], distance: r.distance ?? null };
}

/** Coordinates of the "before" routes, drawn faintly under the active view for comparison. */
export function pickBeforeCoords(routeData, view) {
  if (!routeData || resolveView(routeData, view) === 'nearest_neighbor') return [];
  if (isFleet(routeData)) return routeData.fleet.baseline.routes.map((r) => r.fullCoordinates || []);
  return [routeData.initialFullCoordinates || coordsFromLegs(routeData.initialLegs)];
}
