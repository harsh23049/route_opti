import React, { useMemo } from 'react';

/**
 * CityMap renders an interactive SVG simulated city map.
 * Invariants:
 * 1. Road lines are generated directly from the same graph roads submitted to C++.
 * 2. Route polylines follow actual shortest-path graph coordinates returned by C++.
 * 3. Warehouse/start marker is prominently highlighted.
 * 4. Customer stops are rendered as numbered red markers indicating dispatch order.
 * 5. Delivery route is rendered as a vibrant cyan line with an animated delivery van.
 */
export default function CityMap({
  graph,
  activeRouteData,
  activeAlgorithm = 'two_opt', // 'nearest_neighbor' or 'two_opt'
  simulationProgress = 0, // 0.0 to 1.0
  selectedNodeId,
  onSelectNode
}) {
  const nodes = graph?.nodes || [];
  const roads = graph?.roads || [];
  const warehouseId = graph?.warehouse || 'W';

  const nodeMap = useMemo(() => {
    const map = new Map();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  // SVG canvas dimensions
  const SVG_WIDTH = 840;
  const SVG_HEIGHT = 560;
  const PADDING = 55;

  // Compute coordinate bounding box
  const bounds = useMemo(() => {
    if (nodes.length === 0) {
      return { minLat: 37.77, maxLat: 37.80, minLng: -122.42, maxLng: -122.39 };
    }
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    nodes.forEach((n) => {
      if (n.lat < minLat) minLat = n.lat;
      if (n.lat > maxLat) maxLat = n.lat;
      if (n.lng < minLng) minLng = n.lng;
      if (n.lng > maxLng) maxLng = n.lng;
    });

    const latDelta = maxLat - minLat || 0.005;
    const lngDelta = maxLng - minLng || 0.005;

    return {
      minLat: minLat - latDelta * 0.05,
      maxLat: maxLat + latDelta * 0.05,
      minLng: minLng - lngDelta * 0.05,
      maxLng: maxLng + lngDelta * 0.05
    };
  }, [nodes]);

  // Project geographic coordinates (lat, lng) to SVG canvas coordinates (x, y)
  const project = (lat, lng) => {
    const latSpan = bounds.maxLat - bounds.minLat || 0.01;
    const lngSpan = bounds.maxLng - bounds.minLng || 0.01;

    const x = PADDING + ((lng - bounds.minLng) / lngSpan) * (SVG_WIDTH - 2 * PADDING);
    // Invert Y axis so higher latitude is at the top of the map
    const y = SVG_HEIGHT - (PADDING + ((lat - bounds.minLat) / latSpan) * (SVG_HEIGHT - 2 * PADDING));

    return { x, y };
  };

  // Determine active ordered stop sequence based on selected algorithm view
  const activeStopSequence = useMemo(() => {
    if (!activeRouteData) return [];
    if (activeAlgorithm === 'nearest_neighbor') {
      return activeRouteData.initialRoute || [];
    }
    return activeRouteData.optimizedRoute || [];
  }, [activeRouteData, activeAlgorithm]);

  // Build map of customer stop visit sequence numbers (1-based, excluding warehouse)
  const stopVisitNumberMap = useMemo(() => {
    const orderMap = new Map();
    let counter = 1;
    activeStopSequence.forEach((id) => {
      if (id !== warehouseId && !orderMap.has(id)) {
        orderMap.set(id, counter++);
      }
    });
    return orderMap;
  }, [activeStopSequence, warehouseId]);

  // Compute actual route polyline points from C++ response
  const routePolylinePoints = useMemo(() => {
    if (!activeRouteData) return [];

    const isNN = activeAlgorithm === 'nearest_neighbor';
    let rawCoords = isNN
      ? (activeRouteData.initialFullCoordinates || [])
      : (activeRouteData.fullCoordinates || []);

    if (rawCoords.length === 0) {
      const sourceLegs = isNN && activeRouteData.initialLegs
        ? activeRouteData.initialLegs
        : (activeRouteData.legs || []);

      const collected = [];
      sourceLegs.forEach((leg, legIdx) => {
        if (leg.coordinates) {
          leg.coordinates.forEach((coord, idx) => {
            if (legIdx > 0 && idx === 0) return; // avoid duplicate seam point
            collected.push(coord);
          });
        }
      });
      rawCoords = collected;
    }

    return rawCoords.map(([lat, lng]) => project(lat, lng));
  }, [activeRouteData, activeAlgorithm, bounds]);

  const routePolylineString = useMemo(() => {
    return routePolylinePoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  }, [routePolylinePoints]);

  // Compute simulated vehicle position along route polyline
  const vehiclePosition = useMemo(() => {
    if (routePolylinePoints.length < 2) return null;
    const totalSegments = routePolylinePoints.length - 1;
    const currentProgressIndex = simulationProgress * totalSegments;
    const segmentIdx = Math.min(Math.floor(currentProgressIndex), totalSegments - 1);
    const frac = currentProgressIndex - segmentIdx;

    const pA = routePolylinePoints[segmentIdx];
    const pB = routePolylinePoints[segmentIdx + 1];

    if (!pA || !pB) return routePolylinePoints[0];

    const x = pA.x + (pB.x - pA.x) * frac;
    const y = pA.y + (pB.y - pA.y) * frac;
    const angle = Math.atan2(pB.y - pA.y, pB.x - pA.x) * (180 / Math.PI);

    return { x, y, angle };
  }, [routePolylinePoints, simulationProgress]);

  return (
    <div className="relative w-full aspect-[4/3] max-h-[580px] bg-slate-900/90 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden select-none">
      {/* City Street Grid Background Texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'radial-gradient(rgba(148, 163, 184, 0.25) 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
      />

      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className="w-full h-full"
      >
        <defs>
          {/* Cyan Glow Filter for Active Route */}
          <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 1. Light Neutral Road Network (Built directly from graph.roads) */}
        <g className="road-network">
          {roads.map((road, idx) => {
            const u = nodeMap.get(road.source);
            const v = nodeMap.get(road.target);
            if (!u || !v) return null;

            const p1 = project(u.lat, u.lng);
            const p2 = project(v.lat, v.lng);

            return (
              <g key={`road-${road.source}-${road.target}-${idx}`}>
                {/* Outer light neutral road casing */}
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke="#334155"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                {/* Inner neutral road line */}
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke="#64748b"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                {/* Distance label on road midpoint */}
                {road.distance_km && (
                  <text
                    x={(p1.x + p2.x) / 2}
                    y={(p1.y + p2.y) / 2 - 4}
                    fill="#94a3b8"
                    fontSize="9"
                    fontWeight="500"
                    textAnchor="middle"
                    className="pointer-events-none select-none bg-slate-900/80"
                  >
                    {road.distance_km}km
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* 2. Cyan Delivery Vehicle / Route Polyline (Following actual C++ graph edges) */}
        {routePolylineString && (
          <g className="cyan-delivery-route">
            {/* Cyan background glow */}
            <polyline
              points={routePolylineString}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="7"
              strokeOpacity="0.25"
              filter="url(#cyanGlow)"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Primary cyan delivery path */}
            <polyline
              points={routePolylineString}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        )}

        {/* 3. Animated Cyan Delivery Vehicle Marker */}
        {vehiclePosition && (
          <g
            transform={`translate(${vehiclePosition.x}, ${vehiclePosition.y}) rotate(${vehiclePosition.angle})`}
            className="transition-transform duration-75"
          >
            {/* Radar ping */}
            <circle r="12" fill="#06b6d4" opacity="0.3" className="animate-ping" />
            {/* Vehicle body */}
            <circle r="8" fill="#0e7490" stroke="#06b6d4" strokeWidth="2" />
            {/* Directional arrow */}
            <polygon points="5,0 -3,-4 -1,0 -3,4" fill="#ffffff" />
          </g>
        )}

        {/* 4. Intersections and Junction Nodes */}
        <g className="intersection-markers">
          {nodes.map((node) => {
            if (node.id === warehouseId || stopVisitNumberMap.has(node.id)) return null;
            const pt = project(node.lat, node.lng);
            return (
              <g
                key={`junction-${node.id}`}
                transform={`translate(${pt.x}, ${pt.y})`}
                className="cursor-pointer group"
                onClick={() => onSelectNode && onSelectNode(node.id)}
              >
                <circle
                  r="4"
                  fill="#475569"
                  stroke="#1e293b"
                  strokeWidth="1.5"
                  className="transition-all group-hover:scale-125 group-hover:fill-cyan-400"
                />
                <text
                  x="0"
                  y="-8"
                  fill="#94a3b8"
                  fontSize="9"
                  textAnchor="middle"
                  className="opacity-0 group-hover:opacity-100 transition-opacity font-mono pointer-events-none"
                >
                  {node.id}
                </text>
              </g>
            );
          })}
        </g>

        {/* 5. Warehouse / Start Marker */}
        {nodes
          .filter((n) => n.id === warehouseId)
          .map((wh) => {
            const pt = project(wh.lat, wh.lng);
            return (
              <g
                key={`warehouse-${wh.id}`}
                transform={`translate(${pt.x}, ${pt.y})`}
                className="cursor-pointer group z-20"
                onClick={() => onSelectNode && onSelectNode(wh.id)}
              >
                {/* Pulsing halo */}
                <circle r="16" fill="#f59e0b" opacity="0.25" className="animate-pulse" />
                {/* Warehouse Badge */}
                <rect
                  x="-12"
                  y="-12"
                  width="24"
                  height="24"
                  rx="6"
                  fill="#1e293b"
                  stroke="#f59e0b"
                  strokeWidth="2.5"
                  className="transition-transform group-hover:scale-110"
                />
                {/* Warehouse roof icon */}
                <path d="M -6 -3 L 0 -8 L 6 -3 L 6 6 L -6 6 Z" fill="#f59e0b" />
                <text
                  x="0"
                  y="22"
                  textAnchor="middle"
                  fill="#fbbf24"
                  fontSize="10"
                  fontWeight="bold"
                  className="pointer-events-none drop-shadow"
                >
                  DEPOT
                </text>
              </g>
            );
          })}

        {/* 6. Numbered Red Customer Markers */}
        <g className="customer-stop-markers">
          {nodes
            .filter((n) => stopVisitNumberMap.has(n.id))
            .map((stop) => {
              const pt = project(stop.lat, stop.lng);
              const visitNum = stopVisitNumberMap.get(stop.id);
              const isSelected = selectedNodeId === stop.id;

              return (
                <g
                  key={`stop-${stop.id}`}
                  transform={`translate(${pt.x}, ${pt.y})`}
                  className="cursor-pointer group z-30"
                  onClick={() => onSelectNode && onSelectNode(stop.id)}
                >
                  {/* Outer glow */}
                  <circle
                    r={isSelected ? 16 : 13}
                    fill="#ef4444"
                    opacity="0.3"
                    className="transition-all"
                  />
                  {/* Numbered Red Marker Pin */}
                  <circle
                    r="10"
                    fill="#ef4444"
                    stroke="#ffffff"
                    strokeWidth="2"
                    className="transition-transform group-hover:scale-110 drop-shadow"
                  />
                  {/* Stop Visit Sequence Number */}
                  <text
                    x="0"
                    y="3.5"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="10"
                    fontWeight="800"
                    className="pointer-events-none select-none font-sans"
                  >
                    {visitNum}
                  </text>
                  {/* Stop ID label */}
                  <text
                    x="0"
                    y="-14"
                    textAnchor="middle"
                    fill="#fecaca"
                    fontSize="9"
                    fontWeight="600"
                    className="pointer-events-none opacity-90 group-hover:opacity-100 drop-shadow"
                  >
                    {stop.name || stop.id}
                  </text>
                </g>
              );
            })}
        </g>
      </svg>

      {/* Map Legend */}
      <div className="absolute bottom-2.5 left-2.5 max-w-[calc(100%-1.25rem)] flex flex-wrap items-center gap-2 sm:gap-3 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur border border-slate-800 text-[10px] sm:text-[11px] shadow-lg pointer-events-none">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-amber-500" />
          <span className="text-slate-300 font-medium">Warehouse (Start/End)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 text-white font-bold flex items-center justify-center text-[7px]">
            1
          </span>
          <span className="text-slate-300 font-medium">Numbered Customer Stop</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-1 rounded bg-cyan-400" />
          <span className="text-cyan-400 font-medium">Cyan Delivery Route</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-slate-500" />
          <span className="text-slate-400">Road Network (Graph Edges)</span>
        </div>
      </div>
    </div>
  );
}
