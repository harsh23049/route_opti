/**
 * End-to-end tests (node:test): boots the real backend as a separate process on a free port,
 * which spawns the compiled C++ engine for every request.
 * Requires the engine to be built first: npm run build:cpp
 *
 * Covers: empty/invalid input, unreachable stops, malformed JSON, concurrent requests,
 * that every returned leg (optimized, initial and optimal) follows real road edges, and a
 * multi-van plan on a real OpenStreetMap city preset.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const net = require('net');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const testGraph = {
  warehouse: 'W',
  stops: ['C1', 'C2', 'C3'],
  nodes: [
    { id: 'W', name: 'Distribution Center', lat: 37.7749, lng: -122.4194 },
    { id: 'N1', name: 'Market Junction', lat: 37.7785, lng: -122.4140 },
    { id: 'C1', name: 'Mission Store', lat: 37.7650, lng: -122.4200 },
    { id: 'C2', name: 'Civic Hub', lat: 37.7795, lng: -122.4160 },
    { id: 'C3', name: 'SOMA Depot', lat: 37.7810, lng: -122.4040 }
  ],
  roads: [
    { source: 'W', target: 'N1', distance_km: 1.8 },
    { source: 'W', target: 'C1', distance_km: 2.1 },
    { source: 'N1', target: 'C2', distance_km: 0.6 },
    { source: 'N1', target: 'C3', distance_km: 1.2 },
    { source: 'C2', target: 'C3', distance_km: 1.4 },
    { source: 'C1', target: 'N1', distance_km: 2.5 }
  ]
};

let serverProcess;
let baseUrl;

const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
    probe.on('error', reject);
  });

async function post(body) {
  const res = await fetch(`${baseUrl}/api/optimize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
  return { status: res.status, json: await res.json() };
}

before(async () => {
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  serverProcess = spawn(process.execPath, [path.resolve(__dirname, '../backend/src/app.js')], {
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'ignore', 'inherit']
  });

  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Backend did not become healthy on port ${port}`);
});

after(() => {
  serverProcess?.kill();
});

// Each leg must start/end at its stops, step only along real roads, and sum to its distance.
function assertLegsFollowRoads(route, legs, totalDistance, graph = testGraph) {
  const roadLength = new Map();
  for (const r of graph.roads) {
    roadLength.set(`${r.source}->${r.target}`, r.distance_km);
    roadLength.set(`${r.target}->${r.source}`, r.distance_km);
  }
  const coordOf = new Map(graph.nodes.map((n) => [n.id, [n.lat, n.lng]]));

  assert.equal(legs.length, route.length - 1);
  let total = 0;
  legs.forEach((leg, i) => {
    assert.equal(leg.from, route[i]);
    assert.equal(leg.to, route[i + 1]);
    assert.equal(leg.pathNodes[0], leg.from);
    assert.equal(leg.pathNodes.at(-1), leg.to);

    let legLength = 0;
    for (let s = 0; s < leg.pathNodes.length - 1; s++) {
      const key = `${leg.pathNodes[s]}->${leg.pathNodes[s + 1]}`;
      assert.ok(roadLength.has(key), `step ${key} must be a real road`);
      legLength += roadLength.get(key);
    }
    assert.ok(Math.abs(legLength - leg.distanceKm) < 1e-6, `leg ${i} length matches its road edges`);

    assert.equal(leg.coordinates.length, leg.pathNodes.length);
    leg.pathNodes.forEach((id, k) => assert.deepEqual(leg.coordinates[k], coordOf.get(id)));
    total += leg.distanceKm;
  });
  assert.ok(Math.abs(total - totalDistance) < 1e-6, 'legs sum to the reported tour distance');
}

describe('end-to-end: backend process + C++ engine', () => {
  it('rejects empty input, missing warehouse and empty stops with 400 VALIDATION_ERROR', async () => {
    for (const body of [
      {},
      { stops: ['C1'], nodes: testGraph.nodes, roads: testGraph.roads },
      { ...testGraph, stops: [] }
    ]) {
      const res = await post(body);
      assert.equal(res.status, 400);
      assert.equal(res.json.code, 'VALIDATION_ERROR');
    }
  });

  it('rejects unknown stop IDs', async () => {
    const res = await post({ ...testGraph, stops: ['C1', 'NON_EXISTENT_CUSTOMER_STOP'] });
    assert.equal(res.status, 400);
    assert.match(res.json.error, /NON_EXISTENT_CUSTOMER_STOP/);
  });

  it('rejects an unreachable stop detected by the C++ engine', async () => {
    const res = await post({
      ...testGraph,
      stops: ['C1', 'ISLAND_NODE'],
      nodes: [...testGraph.nodes, { id: 'ISLAND_NODE', lat: 37.85, lng: -122.45 }]
    });
    assert.equal(res.status, 400);
    assert.equal(res.json.code, 'ALGORITHM_ERROR');
    assert.match(res.json.error, /unreachable/i);
  });

  it('rejects malformed JSON syntax', async () => {
    const res = await post('{ "warehouse": "W", "stops": [ invalid json syntax ...');
    assert.equal(res.status, 400);
    assert.equal(res.json.code, 'JSON_SYNTAX_ERROR');
  });

  it('handles concurrent requests (repeated clicks) deterministically', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => post(testGraph)));
    for (const res of results) {
      assert.equal(res.status, 200);
      assert.equal(res.json.optimizedRoute.length, 5);
      assert.equal(res.json.optimizedDistance, results[0].json.optimizedDistance);
    }
  });

  it('returns consistent metrics and legs that follow real roads for every route variant', async () => {
    const res = await post(testGraph);
    assert.equal(res.status, 200);
    const data = res.json;

    for (const route of [data.initialRoute, data.optimizedRoute, data.optimalRoute]) {
      assert.equal(route[0], 'W');
      assert.equal(route.at(-1), 'W');
      for (const stop of testGraph.stops) assert.ok(route.includes(stop), `route visits ${stop}`);
    }

    assert.ok(data.optimizedDistance <= data.initialDistance);
    assert.ok(data.optimalDistance <= data.optimizedDistance + 1e-9);
    assert.ok(Math.abs(data.distanceSaved - (data.initialDistance - data.optimizedDistance)) < 1e-6);
    assert.ok(Math.abs(data.improvementPercent - (data.distanceSaved / data.initialDistance) * 100) < 1e-6);
    assert.ok(data.optimalityGapPercent >= 0);
    assert.ok(data.executionTimeMs >= 0);

    assertLegsFollowRoads(data.optimizedRoute, data.legs, data.optimizedDistance);
    assertLegsFollowRoads(data.initialRoute, data.initialLegs, data.initialDistance);
    assertLegsFollowRoads(data.optimalRoute, data.optimalLegs, data.optimalDistance);
  });

  it('plans 3 vans on a real city preset: every stop served once, on real roads, shorter longest route', async () => {
    const preset = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../frontend/public/cities/delhi_cp.json'), 'utf8')
    );
    const graph = {
      warehouse: preset.warehouse,
      stops: preset.availableCustomerStops.slice(0, preset.defaultStopCount),
      vehicles: 3,
      nodes: preset.nodes.map(({ id, name, lat, lng }) => ({ id, name, lat, lng })),
      roads: preset.roads
    };
    const res = await post(graph);
    assert.equal(res.status, 200);
    const { baseline, optimized } = res.json.fleet;

    for (const plan of [baseline, optimized]) {
      const served = plan.routes.flatMap((r) => r.route.slice(1, -1)).sort();
      assert.deepEqual(served, [...graph.stops].sort());
      assert.ok(plan.routes.length <= 3);
      for (const r of plan.routes) assertLegsFollowRoads(r.route, r.legs, r.distance, graph);
      assert.ok(Math.abs(plan.longestRoute - Math.max(...plan.routes.map((r) => r.distance))) < 1e-9);
    }
    assert.ok(optimized.longestRoute < baseline.longestRoute);
    assert.ok(optimized.longestRoute < res.json.optimizedDistance, 'vans finish sooner than one van');
  });
});
