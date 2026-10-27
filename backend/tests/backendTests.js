const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const app = require('../src/app');

const TEST_PORT = 5088;
let server;

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        ...options
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch (_) {}
          resolve({ status: res.statusCode, headers: res.headers, body: json, rawBody: data });
        });
      }
    );

    req.on('error', reject);

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('======================================================================');
  console.log('  BACKEND EXPRESS API & C++ ENGINE INTEGRATION TEST SUITE');
  console.log('======================================================================\n');

  // Start test server
  await new Promise((resolve) => {
    server = app.listen(TEST_PORT, resolve);
  });

  let totalTests = 0;
  let passedTests = 0;

  async function test(name, fn) {
    totalTests++;
    try {
      await fn();
      passedTests++;
      console.log(`[PASS] ${name}`);
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
    }
  }

  // 1. Test GET /api/health
  await test('GET /api/health returns 200 OK and confirms C++ binary exists', async () => {
    const res = await makeRequest({ path: '/api/health', method: 'GET' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
    assert.strictEqual(res.body.executable.exists, true, 'C++ executable must exist on disk');
  });

  // 2. Test CORS headers for local frontend origin
  await test('CORS headers allow http://localhost:3000', async () => {
    const res = await makeRequest({
      path: '/api/health',
      method: 'GET',
      headers: { Origin: 'http://localhost:3000' }
    });
    assert.strictEqual(res.headers['access-control-allow-origin'], 'http://localhost:3000');
  });

  // 3. Test POST /api/optimize with real sample graph
  await test('POST /api/optimize returns valid C++ route calculation and geometry', async () => {
    const sampleInputPath = path.resolve(__dirname, '../../data/sample-input.json');
    const sampleInput = JSON.parse(fs.readFileSync(sampleInputPath, 'utf8'));

    const res = await makeRequest(
      {
        path: '/api/optimize',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      sampleInput
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);

    // Verify values generated directly by compiled C++ binary
    assert.strictEqual(res.body.initialDistance, 6.9);
    assert.strictEqual(res.body.optimizedDistance, 6.9);
    assert.strictEqual(res.body.distanceSaved, 0);
    assert.strictEqual(typeof res.body.executionTimeMs, 'number');

    // Verify route sequences
    assert.deepStrictEqual(res.body.initialRoute, [
      'node_0', 'node_5', 'node_4', 'node_3', 'node_1', 'node_2', 'node_0'
    ]);
    assert.deepStrictEqual(res.body.optimizedRoute, [
      'node_0', 'node_5', 'node_4', 'node_3', 'node_1', 'node_2', 'node_0'
    ]);

    // Verify legs and geometry for frontend rendering
    assert.ok(Array.isArray(res.body.legs));
    assert.strictEqual(res.body.legs.length, 6);
    assert.strictEqual(res.body.legs[0].from, 'node_0');
    assert.strictEqual(res.body.legs[0].to, 'node_5');
    assert.ok(res.body.legs[0].coordinates.length >= 2);

    assert.ok(Array.isArray(res.body.fullRoadPath));
    assert.ok(res.body.fullRoadPath.length >= 7);
  });

  // 4. Test Validation: Missing warehouse node ID
  await test('POST /api/optimize returns 400 for missing warehouse ID', async () => {
    const res = await makeRequest(
      {
        path: '/api/optimize',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      {
        stops: ['node_1'],
        nodes: [{ id: 'node_1', lat: 0, lng: 0 }],
        roads: []
      }
    );
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, 'VALIDATION_ERROR');
    assert.ok(res.body.error.includes("warehouse"));
  });

  // 5. Test Validation: Non-existent delivery stop ID
  await test('POST /api/optimize returns 400 for non-existent delivery stop', async () => {
    const res = await makeRequest(
      {
        path: '/api/optimize',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      {
        warehouse: 'node_0',
        stops: ['node_GHOST'],
        nodes: [{ id: 'node_0', lat: 0, lng: 0 }],
        roads: []
      }
    );
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, 'VALIDATION_ERROR');
    assert.ok(res.body.error.includes("node_GHOST"));
  });

  // 6. Test Validation: Negative edge distance
  await test('POST /api/optimize returns 400 for negative edge distance', async () => {
    const res = await makeRequest(
      {
        path: '/api/optimize',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      {
        warehouse: 'node_0',
        stops: ['node_1'],
        nodes: [{ id: 'node_0', lat: 0, lng: 0 }, { id: 'node_1', lat: 1, lng: 1 }],
        roads: [{ source: 'node_0', target: 'node_1', distance_km: -2.5 }]
      }
    );
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, 'VALIDATION_ERROR');
    assert.ok(res.body.error.includes("non-negative"));
  });

  // 7. Test C++ Engine Error: Unreachable delivery stop
  await test('POST /api/optimize returns 400 when C++ reports unreachable stop', async () => {
    const res = await makeRequest(
      {
        path: '/api/optimize',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      {
        warehouse: 'W',
        stops: ['S1', 'ISLAND'],
        nodes: [
          { id: 'W', lat: 0, lng: 0 },
          { id: 'S1', lat: 1, lng: 1 },
          { id: 'ISLAND', lat: 5, lng: 5 }
        ],
        roads: [{ source: 'W', target: 'S1', distance_km: 1.0 }]
      }
    );
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, 'ALGORITHM_ERROR');
    assert.ok(res.body.error.includes("Unreachable location"));
  });

  // 8. Test Malformed JSON syntax handling
  await test('POST /api/optimize returns 400 for malformed JSON syntax', async () => {
    const res = await makeRequest(
      {
        path: '/api/optimize',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      '{ bad json here: '
    );
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, 'JSON_SYNTAX_ERROR');
  });

  // 9. Test Unknown Route
  await test('Unknown route returns 404 NOT_FOUND', async () => {
    const res = await makeRequest({ path: '/api/unknown-endpoint', method: 'GET' });
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.code, 'NOT_FOUND');
  });

  // Close server
  await new Promise((resolve) => server.close(resolve));

  console.log('\n======================================================================');
  console.log(`SUMMARY: ${passedTests} / ${totalTests} tests passed`);
  console.log('======================================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  if (server) server.close();
  process.exit(1);
});
