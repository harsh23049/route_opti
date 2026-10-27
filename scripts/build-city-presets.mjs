/**
 * Builds the real-city presets in frontend/public/cities/ from OpenStreetMap data.
 *
 * For each area: downloads drivable roads and named places from the Overpass API, keeps the
 * largest connected road network, simplifies road geometry, then wires the depot and delivery
 * stops onto their nearest roads (same splicing the UI uses for user-added stops).
 *
 * Usage: node scripts/build-city-presets.mjs [--cache <dir>]
 *   --cache  reuse raw Overpass responses from <dir> (and save new ones there).
 *
 * Map data © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright).
 * Roads are treated as two-way; one-way restrictions are not modelled.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withCustomStops } from '../frontend/src/utils/customStops.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'frontend/public/cities');
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const HIGHWAYS = 'primary|secondary|tertiary|residential|unclassified|living_street|primary_link|secondary_link|tertiary_link';
const POI_FILTERS = [
  '["name"]["shop"]',
  '["name"]["amenity"~"^(restaurant|cafe|bank|pharmacy|hospital|clinic|school|college|post_office|cinema|fast_food|marketplace)$"]',
  '["name"]["tourism"~"^(hotel|museum|attraction)$"]'
];
const STOP_COUNT = 20;
const SIMPLIFY_TOLERANCE_KM = 0.004;

const AREAS = [
  {
    id: 'delhi_cp',
    name: 'New Delhi · Connaught Place',
    description: 'Real streets around Connaught Place, New Delhi: the inner and outer circles plus radial roads. Shops and offices are delivery stops.',
    bbox: [28.6225, 77.206, 28.6405, 77.228],
    depot: { name: 'Delivery Hub · Baba Kharak Singh Marg', lat: 28.6268, lng: 77.2092 },
    defaultStopCount: 12
  },
  {
    id: 'bengaluru_koramangala',
    name: 'Bengaluru · Koramangala',
    description: 'Real streets of Koramangala, Bengaluru: a dense residential grid with main roads. Cafes, shops and clinics are delivery stops.',
    bbox: [12.9255, 77.613, 12.9445, 77.636],
    depot: { name: 'Delivery Hub · Hosur Road', lat: 12.9285, lng: 77.6145 },
    defaultStopCount: 14
  }
];

const cacheIdx = process.argv.indexOf('--cache');
const cacheDir = cacheIdx > 0 ? process.argv[cacheIdx + 1] : null;

async function overpass(query, cacheName) {
  const cacheFile = cacheDir && path.join(cacheDir, cacheName);
  if (cacheFile && fs.existsSync(cacheFile)) return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  for (let attempt = 0; attempt < 4; attempt++) {
    for (const url of ENDPOINTS) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'User-Agent': 'route-opti-dataprep/1.0', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: query })
      }).catch(() => null);
      if (res?.ok) {
        const json = await res.json();
        if (cacheFile) fs.writeFileSync(cacheFile, JSON.stringify(json));
        return json;
      }
    }
    await new Promise((r) => setTimeout(r, 10000));
  }
  throw new Error(`Overpass query failed: ${cacheName}`);
}

function haversineKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.sqrt(h));
}

// Douglas-Peucker on a lat/lng polyline; returns the indices to keep (always both ends).
function simplify(points, toleranceKm) {
  const keep = new Set([0, points.length - 1]);
  const kx = 111.32 * Math.cos((points[0].lat * Math.PI) / 180);
  const xy = points.map((p) => [p.lng * kx, p.lat * 110.574]);
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    const [ax, ay] = xy[i], [bx, by] = xy[j];
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    let best = -1, bestD = toleranceKm;
    for (let k = i + 1; k < j; k++) {
      const t = len2 ? Math.max(0, Math.min(1, ((xy[k][0] - ax) * dx + (xy[k][1] - ay) * dy) / len2)) : 0;
      const d = Math.hypot(xy[k][0] - (ax + t * dx), xy[k][1] - (ay + t * dy));
      if (d > bestD) { best = k; bestD = d; }
    }
    if (best > 0) {
      keep.add(best);
      stack.push([i, best], [best, j]);
    }
  }
  return [...keep].sort((a, b) => a - b);
}

function buildRoadGraph(osm) {
  const coords = new Map();
  for (const el of osm.elements) if (el.type === 'node') coords.set(el.id, { lat: el.lat, lng: el.lon });

  // Undirected segment adjacency: osmId -> Map(neighbourOsmId -> street name)
  const adj = new Map();
  const link = (a, b, name) => {
    if (a === b || !coords.has(a) || !coords.has(b)) return;
    if (!adj.has(a)) adj.set(a, new Map());
    if (!adj.has(b)) adj.set(b, new Map());
    adj.get(a).set(b, name);
    adj.get(b).set(a, name);
  };
  for (const el of osm.elements) {
    if (el.type !== 'way') continue;
    const name = el.tags?.['name:en'] || el.tags?.name || el.tags?.ref || '';
    for (let i = 1; i < el.nodes.length; i++) link(el.nodes[i - 1], el.nodes[i], name);
  }

  // Largest connected component only, so every stop is reachable.
  let component = [];
  const seen = new Set();
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const comp = [start];
    seen.add(start);
    for (let i = 0; i < comp.length; i++) {
      for (const nb of adj.get(comp[i]).keys()) {
        if (!seen.has(nb)) { seen.add(nb); comp.push(nb); }
      }
    }
    if (comp.length > component.length) component = comp;
  }
  const inComponent = new Set(component);

  // Junctions (degree != 2, or where the street name changes) always stay.
  const isJunction = (id) => {
    const nbs = adj.get(id);
    if (nbs.size !== 2) return true;
    const [n1, n2] = [...nbs.values()];
    return n1 !== n2;
  };

  const nodeIds = new Map();
  const nodes = [];
  const idOf = (osmId) => {
    if (!nodeIds.has(osmId)) {
      const id = `n${nodeIds.size.toString(36)}`;
      nodeIds.set(osmId, id);
      const c = coords.get(osmId);
      nodes.push({ id, lat: +c.lat.toFixed(6), lng: +c.lng.toFixed(6), type: 'road' });
    }
    return nodeIds.get(osmId);
  };

  const roads = [];
  const doneSegments = new Set();
  const segKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  for (const start of component) {
    if (!isJunction(start)) continue;
    for (const [next, name] of adj.get(start)) {
      if (doneSegments.has(segKey(start, next))) continue;
      // Walk the chain of plain road points until the next junction.
      const chain = [start, next];
      doneSegments.add(segKey(start, next));
      while (!isJunction(chain[chain.length - 1])) {
        const cur = chain[chain.length - 1];
        const prev = chain[chain.length - 2];
        const nb = [...adj.get(cur).keys()].find((x) => x !== prev);
        doneSegments.add(segKey(cur, nb));
        chain.push(nb);
        if (nb === start) break;
      }
      const pts = chain.map((id) => coords.get(id));
      const keep = simplify(pts, SIMPLIFY_TOLERANCE_KM);
      for (let k = 1; k < keep.length; k++) {
        let km = 0;
        for (let m = keep[k - 1]; m < keep[k]; m++) km += haversineKm(pts[m], pts[m + 1]);
        const a = chain[keep[k - 1]], b = chain[keep[k]];
        if (a === b) continue;
        roads.push({ source: idOf(a), target: idOf(b), distance_km: +km.toFixed(4), street_name: name });
      }
    }
  }
  // Rings with no junction at all are dropped; the largest component always has junctions.
  return { nodes, roads, componentSize: inComponent.size };
}

function pickStops(poiOsm, area, count) {
  const [s, w, n, e] = area.bbox;
  const insetLat = (n - s) * 0.08, insetLng = (e - w) * 0.08;
  const byName = new Map();
  for (const el of poiOsm.elements) {
    const lat = el.lat ?? el.center?.lat, lng = el.lon ?? el.center?.lon;
    const name = el.tags?.['name:en'] || el.tags?.name;
    // Short, readable Latin-script names only; skip liquor shops.
    if (lat === undefined || !name || !/^[A-Za-z0-9 &'.,-]{3,36}$/.test(name) || el.tags.shop === 'alcohol') continue;
    if (lat < s + insetLat || lat > n - insetLat || lng < w + insetLng || lng > e - insetLng) continue;
    if (!byName.has(name)) byName.set(name, { name, lat, lng });
  }
  const pool = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  // Farthest-point sampling from the depot spreads stops across the whole area.
  const picked = [];
  const anchors = [area.depot];
  while (picked.length < count && pool.length) {
    let bestIdx = 0, bestD = -1;
    pool.forEach((p, i) => {
      const d = Math.min(...anchors.map((a) => haversineKm(a, p)));
      if (d > bestD) { bestD = d; bestIdx = i; }
    });
    const [p] = pool.splice(bestIdx, 1);
    picked.push(p);
    anchors.push(p);
  }
  return picked;
}

async function buildArea(area) {
  const [s, w, n, e] = area.bbox;
  const box = `(${s},${w},${n},${e})`;
  const roadsOsm = await overpass(
    `[out:json][timeout:90];(way["highway"~"^(${HIGHWAYS})$"]${box};);(._;>;);out body;`,
    `${area.id}-roads.json`
  );
  const poiOsm = await overpass(
    `[out:json][timeout:90];(${POI_FILTERS.map((f) => `nwr${f}${box};`).join('')});out center tags;`,
    `${area.id}-pois.json`
  );

  const network = buildRoadGraph(roadsOsm);
  const stops = pickStops(poiOsm, area, STOP_COUNT);
  const custom = [
    { id: 'W', name: area.depot.name, lat: area.depot.lat, lng: area.depot.lng },
    ...stops.map((p, i) => ({ id: `S${i + 1}`, name: p.name, lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) }))
  ];
  const graph = withCustomStops({ nodes: network.nodes, roads: network.roads }, custom);

  const preset = {
    id: area.id,
    name: area.name,
    description: area.description,
    basemap: 'osm',
    warehouse: 'W',
    availableCustomerStops: stops.map((_, i) => `S${i + 1}`),
    defaultStopCount: area.defaultStopCount,
    nodes: graph.nodes.map(({ id, name, lat, lng, type }) => ({
      id,
      ...(name && type !== 'access' ? { name } : {}),
      lat: +lat.toFixed(6),
      lng: +lng.toFixed(6),
      type: id === 'W' ? 'warehouse' : type
    })),
    roads: graph.roads.map(({ source, target, distance_km, street_name }) => ({ source, target, distance_km, street_name }))
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${area.id}.json`);
  fs.writeFileSync(file, `${JSON.stringify(preset)}\n`);
  console.log(
    `${area.id}: ${network.componentSize} OSM points -> ${preset.nodes.length} nodes, ${preset.roads.length} roads, ` +
      `${stops.length} stops, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`
  );
}

for (const area of AREAS) await buildArea(area);
