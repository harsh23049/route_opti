// Equirectangular projection to km; accurate enough at city scale.
const KM_PER_DEG_LAT = 110.574;
const SNAP_TO_END_KM = 0.02;
const round3 = (x) => Math.round(x * 1000) / 1000;

/**
 * Returns the preset graph with each custom stop attached to its nearest road.
 * The road is split at the closest point and a short spur joins the stop to it,
 * so the engine routes over real streets instead of straight lines.
 * Only spurs are marked `custom`; split halves cover the original road exactly.
 */
export function withCustomStops(preset, customStops) {
  if (customStops.length === 0) return preset;
  const nodes = [...preset.nodes];
  const roads = [...preset.roads];
  const byId = new Map(nodes.map((n) => [n.id, n]));

  for (const stop of customStops) {
    const kx = 111.32 * Math.cos((stop.lat * Math.PI) / 180);
    const toKm = (n) => ({ x: n.lng * kx, y: n.lat * KM_PER_DEG_LAT });
    const p = toKm(stop);

    let best = null;
    roads.forEach((road, idx) => {
      const a = byId.get(road.source), b = byId.get(road.target);
      if (!a || !b) return;
      const pa = toKm(a), pb = toKm(b);
      const dx = pb.x - pa.x, dy = pb.y - pa.y;
      const len2 = dx * dx + dy * dy;
      const t = len2 ? Math.max(0, Math.min(1, ((p.x - pa.x) * dx + (p.y - pa.y) * dy) / len2)) : 0;
      const d = Math.hypot(p.x - (pa.x + t * dx), p.y - (pa.y + t * dy));
      if (!best || d < best.d) best = { idx, road, a, b, t, d, geomKm: Math.sqrt(len2) };
    });

    const node = { id: stop.id, name: stop.name, lat: stop.lat, lng: stop.lng, type: 'customer', custom: true };
    nodes.push(node);
    byId.set(node.id, node);
    if (!best) continue;

    const { road, a, b, t } = best;
    const alongKm = t * road.distance_km;
    let anchor;
    if (alongKm < SNAP_TO_END_KM) anchor = a.id;
    else if (road.distance_km - alongKm < SNAP_TO_END_KM) anchor = b.id;
    else {
      anchor = `${stop.id}-access`;
      const access = {
        id: anchor,
        name: `${road.street_name || 'Road'} access`,
        lat: a.lat + t * (b.lat - a.lat),
        lng: a.lng + t * (b.lng - a.lng),
        type: 'access',
        custom: true
      };
      nodes.push(access);
      byId.set(anchor, access);
      roads.splice(
        best.idx,
        1,
        { ...road, target: anchor, distance_km: round3(alongKm) },
        { ...road, source: anchor, distance_km: round3(road.distance_km - alongKm) }
      );
    }

    // Preset road lengths are not exactly geometric; keep the spur on the same scale.
    const scale = best.geomKm ? road.distance_km / best.geomKm : 1;
    roads.push({ source: anchor, target: stop.id, distance_km: round3(best.d * scale), street_name: '', custom: true });
  }

  return { ...preset, nodes, roads };
}
