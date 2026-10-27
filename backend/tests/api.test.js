/**
 * Backend API tests (node:test). Exercises validation, error mapping and the real C++ engine.
 * Requires the engine to be built first: npm run build:cpp
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const app = require('../src/app');
const config = require('../src/config');

let server;
let baseUrl;

async function request(method, urlPath, body, headers = {}) {
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // non-JSON body; tests that care assert on status
  }
  return { status: res.status, headers: res.headers, body: json };
}

const post = (body) => request('POST', '/api/optimize', body);

const twoNodeGraph = (roadOverrides = {}) => ({
  warehouse: 'node_0',
  stops: ['node_1'],
  nodes: [{ id: 'node_0', lat: 0, lng: 0 }, { id: 'node_1', lat: 1, lng: 1 }],
  roads: [{ source: 'node_0', target: 'node_1', distance_km: 2.5, ...roadOverrides }]
});

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

describe('GET /api/health', () => {
  it('returns 200 and confirms the C++ binary exists without leaking its path', async () => {
    const res = await request('GET', '/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.executable.exists, true, 'C++ executable must exist on disk (npm run build:cpp)');
    assert.equal(res.body.executable.path, undefined);
  });

  it('sends CORS headers for the dev frontend and hides x-powered-by', async () => {
    const res = await request('GET', '/api/health', undefined, { Origin: 'http://localhost:3000' });
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:3000');
    assert.equal(res.headers.get('x-powered-by'), null);
  });
});

describe('POST /api/optimize — engine results', () => {
  it('returns the C++ route, geometry and exact optimum for the sample graph', async () => {
    const sampleInput = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../../data/sample-input.json'), 'utf8')
    );
    const res = await post(sampleInput);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.initialDistance, 5.45);
    assert.equal(res.body.optimizedDistance, 5.1);
    assert.equal(res.body.distanceSaved, 0.35);
    assert.equal(typeof res.body.executionTimeMs, 'number');

    // 2-Opt reverses the node_1/node_2 segment of the greedy tour
    assert.deepEqual(res.body.initialRoute, ['node_0', 'node_1', 'node_2', 'node_3', 'node_4', 'node_0']);
    assert.deepEqual(res.body.optimizedRoute, ['node_0', 'node_2', 'node_1', 'node_3', 'node_4', 'node_0']);

    assert.equal(res.body.legs.length, 5);
    assert.deepEqual(res.body.legs[0].pathNodes, ['node_0', 'j_1', 'node_2']);
    assert.equal(res.body.legs[0].coordinates.length, 3);
    assert.equal(res.body.fullRoadPath.length, 9);

    // 4 stops <= Held-Karp limit, so the exact optimum is reported
    assert.equal(res.body.optimalDistance, 5.1);
    assert.equal(res.body.optimalityGapPercent, 0);
    assert.equal(res.body.optimalLegs.length, 5);
    assert.deepEqual(res.body.stages.map((s) => s.distanceKm), [5.45, 5.1, 5.1]);
  });

  it('maps an unreachable stop reported by C++ to 400 ALGORITHM_ERROR', async () => {
    const res = await post({
      warehouse: 'W',
      stops: ['S1', 'ISLAND'],
      nodes: [{ id: 'W' }, { id: 'S1' }, { id: 'ISLAND' }],
      roads: [{ source: 'W', target: 'S1', distance_km: 1.0 }]
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'ALGORITHM_ERROR');
    assert.match(res.body.error, /Unreachable location/);
  });

  it('returns 503 ENGINE_BUSY when the job pool and queue are full', async () => {
    const saved = { jobs: config.maxConcurrentJobs, queue: config.maxQueuedJobs };
    config.maxConcurrentJobs = 0;
    config.maxQueuedJobs = 0;
    try {
      const res = await post(twoNodeGraph());
      assert.equal(res.status, 503);
      assert.equal(res.body.code, 'ENGINE_BUSY');
    } finally {
      config.maxConcurrentJobs = saved.jobs;
      config.maxQueuedJobs = saved.queue;
    }
  });
});

describe('POST /api/optimize — validation', () => {
  const expectValidationError = async (body, fragment) => {
    const res = await post(body);
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.code, 'VALIDATION_ERROR');
    assert.ok(res.body.error.includes(fragment), `"${res.body.error}" should mention "${fragment}"`);
  };

  it('rejects a missing warehouse', () =>
    expectValidationError({ stops: ['node_1'], nodes: [{ id: 'node_1' }], roads: [] }, 'warehouse'));

  it('rejects a non-existent delivery stop', () =>
    expectValidationError({ ...twoNodeGraph(), stops: ['node_GHOST'] }, 'node_GHOST'));

  it('rejects a negative edge distance', () =>
    expectValidationError(twoNodeGraph({ distance_km: -2.5 }), 'non-negative'));

  it('rejects a missing distance instead of treating it as 0 km', () =>
    expectValidationError(twoNodeGraph({ distance_km: undefined }), 'distance_km'));

  it('rejects legacy aliases (distanceKm, warehouseId, deliveryStops)', async () => {
    await expectValidationError(twoNodeGraph({ distance_km: undefined, distanceKm: 1 }), 'distance_km');
    const { warehouse, stops, ...rest } = twoNodeGraph();
    await expectValidationError({ ...rest, warehouseId: warehouse, stops }, 'warehouse');
    await expectValidationError({ ...rest, warehouse, deliveryStops: stops }, 'stops');
  });

  it('rejects object-shaped stops', () =>
    expectValidationError({ ...twoNodeGraph(), stops: [{ id: 'node_1' }] }, 'Stop at index 0'));

  it('rejects 1e400 (Infinity after JSON.parse) as a distance', async () => {
    const raw = JSON.stringify(twoNodeGraph()).replace('2.5', '1e400');
    await expectValidationError(raw, 'distance_km');
  });

  it('rejects out-of-range coordinates', () =>
    expectValidationError(
      { ...twoNodeGraph(), nodes: [{ id: 'node_0', lat: 91, lng: 0 }, { id: 'node_1' }] },
      "'lat'"
    ));

  it('enforces the stop count limit', () =>
    expectValidationError(
      { ...twoNodeGraph(), stops: Array(config.limits.maxStops + 1).fill('node_1') },
      'limit'
    ));
});

describe('error handling', () => {
  it('returns 400 JSON_SYNTAX_ERROR for malformed JSON', async () => {
    const res = await post('{ bad json here: ');
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'JSON_SYNTAX_ERROR');
  });

  it('returns 413 PAYLOAD_TOO_LARGE above the body limit', async () => {
    const res = await post(JSON.stringify({ padding: 'x'.repeat(3 * 1024 * 1024) }));
    assert.equal(res.status, 413);
    assert.equal(res.body.code, 'PAYLOAD_TOO_LARGE');
  });

  it('returns 404 NOT_FOUND for unknown API routes', async () => {
    const res = await request('GET', '/api/unknown-endpoint');
    assert.equal(res.status, 404);
    assert.equal(res.body.code, 'NOT_FOUND');
  });
});
