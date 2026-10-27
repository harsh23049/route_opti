import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { ACCENT } from '../utils/routeView';

const LABEL_SIZE = 12.5;
const ROAD_LABEL_SIZE = 10.5;
const textWidth = (s, size) => s.length * size * 0.56;
const hits = (a, list) => list.some((b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y);

function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Vehicle position by travelled length along the polyline.
function vehicleAt(points, progress) {
  if (points.length < 2) return null;
  const seg = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    seg.push(d);
    total += d;
  }
  let target = Math.min(1, Math.max(0, progress)) * total;
  for (let i = 0; i < seg.length; i++) {
    if (target <= seg[i] || i === seg.length - 1) {
      const f = seg[i] ? Math.min(1, target / seg[i]) : 0;
      const a = points[i], b = points[i + 1];
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    }
    target -= seg[i];
  }
  return null;
}

// Direction chevrons every ~72px along a path, kept clear of the vertices.
function chevronsAlong(points) {
  const out = [];
  let carry = 36;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    let t = carry;
    while (t < len) {
      if (t > 20 && len - t > 20) out.push({ x: a.x + ((b.x - a.x) * t) / len, y: a.y + ((b.y - a.y) * t) / len, ang });
      t += 72;
    }
    carry = t - len;
  }
  return out;
}

const toPolyline = (pts) => pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

// Web Mercator in "world pixels" at zoom 0 (256 px wide), the projection map tiles use.
const TILE = 256;
const mercX = (lng) => ((lng + 180) / 360) * TILE;
const mercY = (lat) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE;
};
const lngOf = (x) => (x / TILE) * 360 - 180;
const latOf = (y) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / TILE))) * 180) / Math.PI;

// Esri World Light Gray Canvas: no API key, street names included. Detail ends at zoom 16;
// deeper zooms scale those tiles up.
const TILE_MAX_ZOOM = 16;
const tileUrl = (z, x, y) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/${z}/${y}/${x}`;

/**
 * Full-bleed SVG city map. Presets with `basemap: 'osm'` are drawn on real map tiles;
 * the others get an illustrated basemap with roads from the same graph sent to the backend.
 * Route lines use the coordinates returned by the backend: one line per van, plus the
 * "before" routes drawn faintly underneath for comparison.
 * Clicking a non-warehouse node toggles it as a stop; in add mode, clicking
 * empty map drops a new stop there.
 */
export default function CityMap({
  graph,
  selectedStops,
  routeView,
  beforeCoords,
  hasRoute,
  simulationProgress = 0,
  isPlaying,
  selectedNodeId,
  hoveredNodeId,
  onToggleStop,
  togglingDisabled,
  addMode,
  onAddStop,
  insets
}) {
  const wrapRef = useRef(null);
  const dragRef = useRef(null);
  const [size, setSize] = useState({ w: 1200, h: 800 });
  const [zoom, setZoom] = useState({ k: 1, x: 0, y: 0 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const update = () => setSize({ w: el.clientWidth || 1200, h: el.clientHeight || 800 });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const nodes = useMemo(() => graph?.nodes || [], [graph]);
  const roads = useMemo(() => graph?.roads || [], [graph]);
  const warehouseId = graph?.warehouse || 'W';
  const basemap = graph?.basemap === 'osm';
  // Framing and basemap come from the preset only, so adding a stop never moves the map.
  const baseNodes = useMemo(() => nodes.filter((n) => !n.custom), [nodes]);
  const baseRoads = useMemo(() => roads.filter((r) => !r.custom), [roads]);

  const nodeMap = useMemo(() => {
    const map = new Map();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  const bounds = useMemo(() => {
    if (baseNodes.length === 0) return { minLat: 37.77, maxLat: 37.8, minLng: -122.42, maxLng: -122.39 };
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    baseNodes.forEach((n) => {
      minLat = Math.min(minLat, n.lat);
      maxLat = Math.max(maxLat, n.lat);
      minLng = Math.min(minLng, n.lng);
      maxLng = Math.max(maxLng, n.lng);
    });
    return { minLat, maxLat, minLng, maxLng };
  }, [baseNodes]);

  const ins = insets || { left: 40, top: 40, right: 40, bottom: 40 };
  const safe = {
    x: ins.left,
    y: ins.top,
    w: Math.max(120, size.w - ins.left - ins.right),
    h: Math.max(120, size.h - ins.top - ins.bottom)
  };

  // Fit the node bounds into the safe area, then apply pan/zoom. Screen = origin + world * scale,
  // an affine map, so tiles and overlays stay aligned.
  const cam = useMemo(() => {
    const x0 = mercX(bounds.minLng), y0 = mercY(bounds.maxLat);
    const spanX = mercX(bounds.maxLng) - x0 || 1e-6;
    const spanY = mercY(bounds.minLat) - y0 || 1e-6;
    const s = Math.min(safe.w / spanX, safe.h / spanY);
    const ox = safe.x + (safe.w - spanX * s) / 2, oy = safe.y + (safe.h - spanY * s) / 2;
    const cx = safe.x + safe.w / 2, cy = safe.y + safe.h / 2;
    return {
      scale: s * zoom.k,
      ax: cx + (ox - x0 * s - cx) * zoom.k + zoom.x,
      ay: cy + (oy - y0 * s - cy) * zoom.k + zoom.y
    };
  }, [bounds, safe.x, safe.y, safe.w, safe.h, zoom]);

  const project = useCallback(
    (lat, lng) => ({ x: cam.ax + mercX(lng) * cam.scale, y: cam.ay + mercY(lat) * cam.scale }),
    [cam]
  );

  // Screen -> lat/lng, the inverse of project().
  const unproject = (x, y) => ({ lat: latOf((y - cam.ay) / cam.scale), lng: lngOf((x - cam.ax) / cam.scale) });

  const tiles = useMemo(() => {
    if (!basemap) return [];
    // One zoom level deeper on high-DPI screens keeps street names sharp.
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const z = Math.max(0, Math.min(TILE_MAX_ZOOM, Math.round(Math.log2(cam.scale * dpr))));
    const n = 2 ** z;
    const tileSize = (TILE / n) * cam.scale;
    const range = (origin, length) => [
      Math.max(0, Math.floor(-origin / tileSize)),
      Math.min(n - 1, Math.floor((length - origin) / tileSize))
    ];
    const [tx0, tx1] = range(cam.ax, size.w);
    const [ty0, ty1] = range(cam.ay, size.h);
    const out = [];
    for (let tx = tx0; tx <= tx1; tx++) {
      for (let ty = ty0; ty <= ty1; ty++) {
        out.push({ key: `${z}/${tx}/${ty}`, href: tileUrl(z, tx, ty), x: cam.ax + tx * tileSize, y: cam.ay + ty * tileSize, size: tileSize });
      }
    }
    return out;
  }, [basemap, cam, size.w, size.h]);

  // Normalised (u = east, v = north, 0..1 over the node bounds) -> screen.
  const projN = useCallback(
    (u, v) =>
      project(
        bounds.minLat + v * (bounds.maxLat - bounds.minLat),
        bounds.minLng + u * (bounds.maxLng - bounds.minLng)
      ),
    [project, bounds]
  );

  // Decorative basemap features, deterministic per graph.
  const decor = useMemo(() => {
    if (basemap) return { parks: [], minor: [] };
    const latS = bounds.maxLat - bounds.minLat || 0.01;
    const lngS = bounds.maxLng - bounds.minLng || 0.01;
    const norm = (n) => [(n.lng - bounds.minLng) / lngS, (n.lat - bounds.minLat) / latS];
    const pts = baseNodes.map(norm);
    const segs = baseRoads
      .map((r) => [nodeMap.get(r.source), nodeMap.get(r.target)])
      .filter(([a, b]) => a && b)
      .map(([a, b]) => [...norm(a), ...norm(b)]);
    const parks = [];
    const cands = [];
    for (let u = 0.1; u < 0.95; u += 0.1) {
      for (let v = 0.1; v < 0.95; v += 0.1) {
        const dn = Math.min(...pts.map(([a, b]) => Math.hypot(a - u, b - v)));
        const dr = Math.min(...segs.map(([a, b, c, d]) => segDist(u, v, a, b, c, d)));
        if (dn > 0.17 && dr > 0.08) cands.push({ u, v, score: Math.min(dn, dr * 2) });
      }
    }
    cands.sort((a, b) => b.score - a.score);
    cands.forEach((c) => {
      if (parks.length < 3 && parks.every((p) => Math.hypot(p.u - c.u, p.v - c.v) > 0.25)) parks.push(c);
    });
    const rand = seeded(Math.round(Math.abs(bounds.minLat * 1e4 + bounds.minLng * 1e3)));
    const minor = [];
    for (let i = 0; i < 9; i++) {
      const t = -0.25 + i * 0.19 + rand() * 0.06;
      const skew = (rand() - 0.5) * 0.12;
      minor.push([-0.6, t - skew, 1.6, t + skew]);
      const t2 = -0.25 + i * 0.19 + rand() * 0.06;
      minor.push([t2 - skew, -0.6, t2 + skew, 1.6]);
    }
    return { parks, minor };
  }, [basemap, baseNodes, baseRoads, nodeMap, bounds]);

  const selectedSet = useMemo(() => new Set(selectedStops), [selectedStops]);

  // Stop id -> visit order within its van and the van's colour.
  const visits = useMemo(() => {
    const map = new Map();
    if (!hasRoute) return map;
    routeView.routes.forEach((r) => {
      let n = 1;
      r.route.forEach((id) => {
        if (id !== warehouseId && !map.has(id)) map.set(id, { n: n++, color: routeView.fleet ? r.color : ACCENT });
      });
    });
    return map;
  }, [routeView, hasRoute, warehouseId]);

  const toPoints = useCallback((coords) => coords.map(([lat, lng]) => project(lat, lng)), [project]);
  const lines = useMemo(
    () => (hasRoute ? routeView.routes.map((r) => ({ ...r, points: toPoints(r.coords) })) : []),
    [routeView, hasRoute, toPoints]
  );
  const beforeLines = useMemo(() => (hasRoute ? (beforeCoords || []).map(toPoints) : []), [beforeCoords, hasRoute, toPoints]);
  const chevrons = useMemo(() => lines.map((l) => chevronsAlong(l.points)), [lines]);

  // All vans leave together at the same speed, so shorter routes finish first.
  const longest = Math.max(0, ...lines.map((l) => l.distance || 0));
  const vehicles = lines.map((l) => ({
    color: routeView.fleet ? l.color : ACCENT,
    pos: vehicleAt(l.points, longest && l.distance ? (simulationProgress * longest) / l.distance : simulationProgress)
  }));

  const handleKey = (e, id) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggleStop(id);
    }
  };

  const zoomBy = (f) =>
    setZoom((z) => {
      const k = Math.min(8, Math.max(0.75, z.k * f));
      const r = k / z.k;
      return { k, x: z.x * r, y: z.y * r };
    });

  const onPointerDown = (e) => {
    dragRef.current = { x: e.clientX, y: e.clientY, zx: zoom.x, zy: zoom.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    setZoom((z) => ({ ...z, x: d.zx + e.clientX - d.x, y: d.zy + e.clientY - d.y }));
  };
  const onPointerUp = (e) => {
    const d = dragRef.current;
    dragRef.current = null;
    // A click (not a pan) in add mode drops a stop at that point.
    if (!d || !addMode || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
    const box = wrapRef.current.getBoundingClientRect();
    onAddStop(unproject(e.clientX - box.left, e.clientY - box.top));
  };
  const onPointerCancel = () => {
    dragRef.current = null;
  };

  // ---- layout of markers and labels (greedy, collision-aware) ----
  const markerR = (n) =>
    n.id === warehouseId ? 16 : selectedSet.has(n.id) ? 12 : n.type === 'customer' ? 6 : 4;
  const screen = nodes
    .filter((n) => n.type !== 'access' && n.type !== 'road')
    .map((n) => ({ n, ...project(n.lat, n.lng), r: markerR(n) }));
  const placed = screen.map(({ x, y, r }) => ({ x: x - r - 2, y: y - r - 2, w: 2 * r + 4, h: 2 * r + 4 }));
  if (ins.left > 120) placed.push({ x: 0, y: 0, w: ins.left - 12, h: size.h });
  const inView = (b) => b.x > 6 && b.y > 6 && b.x + b.w < size.w - 6 && b.y + b.h < size.h - 6;

  const labels = [];
  const placeLabel = ({ n, x, y, r }, preferBelow) => {
    const isStop = selectedSet.has(n.id) || n.id === warehouseId;
    const size_ = LABEL_SIZE;
    const w = textWidth(n.name, size_) + (isStop ? 6 : 2);
    const h = size_ + 4;
    const right = { tx: x + r + 6, ty: y + size_ * 0.36, anchor: 'start', box: { x: x + r + 4, y: y - h / 2, w: w + 4, h } };
    const left = { tx: x - r - 6, ty: y + size_ * 0.36, anchor: 'end', box: { x: x - r - 8 - w, y: y - h / 2, w: w + 4, h } };
    const above = { tx: x, ty: y - r - 6, anchor: 'middle', box: { x: x - w / 2 - 2, y: y - r - 6 - size_, w: w + 4, h } };
    const below = { tx: x, ty: y + r + size_ + 3, anchor: 'middle', box: { x: x - w / 2 - 2, y: y + r + 1, w: w + 4, h } };
    const order = preferBelow ? [below, right, left, above] : [right, left, above, below];
    const pick = order.find((c) => inView(c.box) && !hits(c.box, placed));
    if (!pick && (!isStop || ins.left <= 120)) return;
    const c = pick || order[0];
    placed.push(c.box);
    labels.push({ id: n.id, text: n.name, x: c.tx, y: c.ty, anchor: c.anchor, strong: isStop });
  };
  screen.filter((s) => s.n.id === warehouseId).forEach((s) => placeLabel(s, true));
  screen.filter((s) => selectedSet.has(s.n.id)).forEach((s) => placeLabel(s, false));
  screen.filter((s) => s.n.type === 'customer' && !selectedSet.has(s.n.id)).forEach((s) => placeLabel(s, false));

  // Keep street names off the route lines.
  for (const { points } of lines) {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      for (let t = 0; t <= len; t += 6) {
        const px = a.x + ((b.x - a.x) * t) / (len || 1), py = a.y + ((b.y - a.y) * t) / (len || 1);
        placed.push({ x: px - 5, y: py - 5, w: 10, h: 10 });
      }
    }
  }
  // Map tiles already carry street names.
  const roadLabels = [];
  roads.forEach((road, idx) => {
    const u = nodeMap.get(road.source), v = nodeMap.get(road.target);
    if (basemap || !u || !v || !road.street_name) return;
    const p1 = project(u.lat, u.lng), p2 = project(v.lat, v.lng);
    const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const w = textWidth(road.street_name, ROAD_LABEL_SIZE);
    if (len < w + 56) return;
    let ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    if (ang > Math.PI / 2) ang -= Math.PI;
    if (ang < -Math.PI / 2) ang += Math.PI;
    const h = ROAD_LABEL_SIZE + 2;
    const ex = Math.abs(Math.cos(ang)) * (w / 2) + Math.abs(Math.sin(ang)) * (h / 2);
    const ey = Math.abs(Math.sin(ang)) * (w / 2) + Math.abs(Math.cos(ang)) * (h / 2);
    const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
    for (const side of [1, -1]) {
      const ox = -Math.sin(ang) * 11 * side, oy = Math.cos(ang) * 11 * side;
      const box = { x: mx + ox - ex, y: my + oy - ey, w: ex * 2, h: ey * 2 };
      if (inView(box) && !hits(box, placed)) {
        placed.push(box);
        roadLabels.push({ key: `rl-${idx}`, x: mx + ox, y: my + oy, deg: (ang * 180) / Math.PI, text: road.street_name });
        return;
      }
    }
  });

  const halo = { stroke: '#ffffff', strokeWidth: 3.5, strokeLinejoin: 'round', paintOrder: 'stroke' };
  const iconBtn =
    'flex h-11 w-11 items-center justify-center text-[#374151] hover:bg-[#F3F4F6] hover:text-[#111827]';

  const river = [projN(1.2, -0.7), projN(1.1, 0.3), projN(1.32, 0.9), projN(1.22, 1.8)];

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <svg
        width={size.w}
        height={size.h}
        viewBox={`0 0 ${size.w} ${size.h}`}
        className="block select-none"
        role="group"
        aria-label="City map"
      >
        <defs>
          <filter id="pin-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodColor="#111827" floodOpacity="0.28" />
          </filter>
        </defs>

        <rect
          width={size.w}
          height={size.h}
          fill={basemap ? '#F2F0EB' : '#F3F1EC'}
          className={addMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}
          data-role="map-surface"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        />

        {tiles.length > 0 && (
          <g className="pointer-events-none" data-role="tiles">
            {tiles.map((t) => (
              <image key={t.key} href={t.href} x={t.x} y={t.y} width={t.size + 0.5} height={t.size + 0.5} preserveAspectRatio="none" />
            ))}
          </g>
        )}

        {!basemap && (
        <g className="pointer-events-none">
          {decor.minor.map(([a, b, c, d], i) => {
            const p = projN(a, b), q = projN(c, d);
            return <line key={`m-${i}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#FBFAF7" strokeWidth={3} />;
          })}
          <path
            d={`M${river[0].x},${river[0].y} C${river[1].x},${river[1].y} ${river[2].x},${river[2].y} ${river[3].x},${river[3].y}`}
            fill="none"
            stroke="#D8E3EA"
            strokeWidth={46 * zoom.k}
            strokeLinecap="round"
          />
          {decor.parks.map((pk, i) => {
            const a = projN(pk.u - 0.075, pk.v + 0.055), b = projN(pk.u + 0.075, pk.v - 0.055);
            return (
              <rect key={`p-${i}`} x={a.x} y={a.y} width={b.x - a.x} height={b.y - a.y} rx={10} fill="#E2EBD9" />
            );
          })}
        </g>
        )}

        {!basemap && (
        <g className="pointer-events-none">
          {roads.map((road, idx) => {
            const u = nodeMap.get(road.source), v = nodeMap.get(road.target);
            if (!u || !v) return null;
            const p1 = project(u.lat, u.lng), p2 = project(v.lat, v.lng);
            const major = road.distance_km >= 0.85;
            return (
              <line key={`rc-${idx}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#D6D2C8" strokeWidth={major ? 11 : 8} strokeLinecap="round" />
            );
          })}
          {roads.map((road, idx) => {
            const u = nodeMap.get(road.source), v = nodeMap.get(road.target);
            if (!u || !v) return null;
            const p1 = project(u.lat, u.lng), p2 = project(v.lat, v.lng);
            const major = road.distance_km >= 0.85;
            return (
              <line key={`rf-${idx}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#FFFFFF" strokeWidth={major ? 8 : 5} strokeLinecap="round" />
            );
          })}
          {roadLabels.map((l) => (
            <text
              key={l.key}
              x={l.x}
              y={l.y}
              transform={`rotate(${l.deg.toFixed(1)} ${l.x.toFixed(1)} ${l.y.toFixed(1)})`}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={ROAD_LABEL_SIZE}
              fill="#8A867D"
              {...halo}
              stroke="#F3F1EC"
            >
              {l.text}
            </text>
          ))}
        </g>
        )}

        {beforeLines.length > 0 && (
          <g className="pointer-events-none" data-role="before">
            {beforeLines.map((pts, i) => (
              <polyline
                key={`bf-${i}`}
                points={toPolyline(pts)}
                fill="none"
                stroke="#4B5563"
                strokeOpacity="0.5"
                strokeWidth={3}
                strokeDasharray="1 6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </g>
        )}

        {lines.map((line, li) => {
          const polyline = toPolyline(line.points);
          return (
            <g key={`route-${li}`} className="route">
              {line.casing && (
                <polyline points={polyline} fill="none" stroke={line.casing} strokeWidth={line.width + 3} strokeLinecap="round" strokeLinejoin="round" />
              )}
              <polyline
                points={polyline}
                fill="none"
                stroke={line.color}
                strokeWidth={line.width}
                strokeDasharray={line.dash || undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
                data-role="route"
                data-vehicle={line.vehicle ?? undefined}
              />
              <polyline points={polyline} fill="none" stroke="transparent" strokeWidth={18} />
              <polyline
                className="route-flow pointer-events-none"
                points={polyline}
                fill="none"
                stroke="#ffffff"
                strokeOpacity="0.55"
                strokeWidth={2}
                strokeDasharray="4 12"
                strokeLinecap="round"
              />
              <g className="pointer-events-none">
                {chevrons[li].map((c, i) => (
                  <path
                    key={`cv-${i}`}
                    d="M-2.5,-3.5 L1.5,0 L-2.5,3.5"
                    transform={`translate(${c.x.toFixed(1)} ${c.y.toFixed(1)}) rotate(${c.ang.toFixed(1)})`}
                    fill="none"
                    stroke={line.dash ? '#6B7280' : '#ffffff'}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </g>
            </g>
          );
        })}

        {screen.map(({ n: node, x, y, r }) => {
          const isHighlighted = selectedNodeId === node.id;
          const isHovered = hoveredNodeId === node.id;
          if (node.id === warehouseId) {
            return (
              <g key={node.id} transform={`translate(${x}, ${y})`} data-role="depot" className="pointer-events-none">
                <rect x="-20" y="-20" width="40" height="40" rx="11" fill="none" stroke={ACCENT} strokeWidth="2" opacity={isHighlighted || isHovered ? 1 : 0} />
                <g filter="url(#pin-shadow)">
                  <rect x="-14" y="-14" width="28" height="28" rx="7" fill="#111827" stroke="#ffffff" strokeWidth="2.5" />
                </g>
                <path d="M-6.5,0 L0,-5.5 L6.5,0 V6 H-6.5 Z" fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M-2,6 V2 H2 V6" fill="none" stroke="#ffffff" strokeWidth="1.6" />
              </g>
            );
          }
          const isStop = selectedSet.has(node.id);
          const visit = visits.get(node.id);
          const order = visit?.n;
          return (
            <g
              key={node.id}
              transform={`translate(${x}, ${y})`}
              className={`map-node ${isHovered ? 'is-hovered' : ''} ${togglingDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              data-role={isStop ? 'stop' : 'station'}
              role="button"
              tabIndex={0}
              aria-pressed={isStop}
              aria-disabled={togglingDisabled || undefined}
              aria-label={node.custom ? `Remove stop ${node.name}` : `Toggle stop ${node.id} – ${node.name}`}
              onClick={() => onToggleStop(node.id)}
              onKeyDown={(e) => handleKey(e, node.id)}
            >
              <circle r="22" fill="transparent" />
              <circle className="hover-ring" r={r + 6} fill={ACCENT} fillOpacity="0.12" opacity={isHovered && !isHighlighted ? 1 : 0} />
              <circle className="focus-ring" r={r + 6} fill={ACCENT} fillOpacity="0.1" stroke={ACCENT} strokeWidth="2" opacity={isHighlighted ? 1 : 0} />
              <g className="pin">
                {isStop ? (
                  <g filter="url(#pin-shadow)">
                    <circle r={r} fill={visit?.color || ACCENT} stroke="#ffffff" strokeWidth="2.5" />
                  </g>
                ) : (
                  <circle r={r} fill="#ffffff" stroke={node.type === 'customer' ? '#9CA3AF' : '#B9B5AC'} strokeWidth="1.5" />
                )}
                {isStop && order === undefined && <circle r="3.2" fill="#ffffff" />}
                {isStop && order !== undefined && (
                  <text y="4" textAnchor="middle" fontSize="11.5" fontWeight="650" fill="#ffffff" data-role="order" className="tnum">
                    {order}
                  </text>
                )}
              </g>
            </g>
          );
        })}

        <g className="pointer-events-none">
          {labels.map((l) => (
            <text
              key={`lb-${l.id}`}
              x={l.x}
              y={l.y}
              textAnchor={l.anchor}
              fontSize={LABEL_SIZE}
              fontWeight={l.strong ? 600 : 400}
              fill={l.strong ? '#111827' : '#6B7280'}
              {...halo}
            >
              {l.text}
            </text>
          ))}
        </g>

        {(isPlaying || simulationProgress > 0) &&
          vehicles.map(({ pos, color }, i) =>
            pos ? (
              <g key={`veh-${i}`} transform={`translate(${pos.x}, ${pos.y})`} className="pointer-events-none" data-role="vehicle">
                <circle className={isPlaying ? 'vehicle-halo' : ''} r="16" fill={color} opacity={isPlaying ? undefined : 0.16} />
                <g filter="url(#pin-shadow)">
                  <circle r="7.5" fill="#ffffff" />
                </g>
                <circle r="5" fill={color} />
              </g>
            ) : null
          )}
      </svg>

      {basemap && (
        <div className="absolute left-2 top-1 rounded bg-white/80 px-1.5 py-0.5 text-[10.5px] text-[#4B5563] lg:bottom-1 lg:left-auto lg:right-2 lg:top-auto">
          Roads ©{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">
            OpenStreetMap
          </a>{' '}
          contributors · Tiles © Esri — Esri, HERE, Garmin
        </div>
      )}

      <div className="float-card absolute right-4 top-4 flex flex-col overflow-hidden rounded-xl">
        <button type="button" className={iconBtn} onClick={() => zoomBy(1.3)} aria-label="Zoom in">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
        <div className="h-px bg-[#EEF0F3]" />
        <button type="button" className={iconBtn} onClick={() => zoomBy(1 / 1.3)} aria-label="Zoom out">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
        <div className="h-px bg-[#EEF0F3]" />
        <button type="button" className={iconBtn} onClick={() => setZoom({ k: 1, x: 0, y: 0 })} aria-label="Fit map to stops">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
          </svg>
        </button>
      </div>
    </div>
  );
}
