/**
 * scripts/e2e-test.js
 * Comprehensive End-to-End Integration Test Suite
 *
 * Verifies end-to-end flow:
 * 1. Express backend boots on a dedicated test port.
 * 2. C++ executable is invoked via child_process.spawn.
 * 3. Tests covered:
 *    - Test 1: Empty input rejection (HTTP 400)
 *    - Test 2: Invalid stop IDs rejection (HTTP 400)
 *    - Test 3: Unreachable customer rejection (HTTP 400)
 *    - Test 4: Malformed JSON syntax rejection (HTTP 400)
 *    - Test 5: Repeated clicks / Concurrent requests (5 simultaneous POST requests)
 *    - Test 6: Successful optimization and full graph edge verification:
 *              - Start & end at warehouse
 *              - All stops visited
 *              - Every leg's pathNodes follows true graph road edges
 *              - Distance metrics and improvement percentage match route legs
 *              - C++ execution time is reported
 */

const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const TEST_PORT = 5099;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

// Sample Road Network for testing
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
    { source: 'W', target: 'N1', distanceKm: 1.8 },
    { source: 'W', target: 'C1', distanceKm: 2.1 },
    { source: 'N1', target: 'C2', distanceKm: 0.6 },
    { source: 'N1', target: 'C3', distanceKm: 1.2 },
    { source: 'C2', target: 'C3', distanceKm: 1.4 },
    { source: 'C1', target: 'N1', distanceKm: 2.5 }
  ]
};

function makeRequest(method, urlPath, body = null, rawHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...rawHeaders
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {
          json = null;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data,
          json
        });
      });
    });

    req.on('error', reject);

    if (body !== null) {
      if (typeof body === 'string') {
        req.write(body);
      } else {
        req.write(JSON.stringify(body));
      }
    }
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runAllTests() {
  console.log('='.repeat(70));
  console.log('  SMART DELIVERY ROUTE OPTIMIZATION - END-TO-END INTEGRATION TESTS');
  console.log('='.repeat(70));
  console.log(`Starting backend server on test port ${TEST_PORT}...`);

  // Start backend server as a child process
  const backendScript = path.resolve(__dirname, '../backend/src/app.js');
  const serverEnv = { ...process.env, PORT: String(TEST_PORT) };
  const serverProcess = spawn('node', [backendScript], {
    env: serverEnv,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  serverProcess.stderr.on('data', (d) => {
    // Optionally log debug or keep clean
  });

  // Wait for server to boot and respond to health check
  let ready = false;
  for (let i = 0; i < 30; ++i) {
    await new Promise((r) => setTimeout(r, 150));
    try {
      const res = await makeRequest('GET', '/api/health');
      if (res.status === 200 && res.json && res.json.status === 'ok') {
        ready = true;
        break;
      }
    } catch (_) {}
  }

  if (!ready) {
    serverProcess.kill();
    throw new Error(`Failed to start backend server on port ${TEST_PORT} within 4.5s`);
  }

  console.log('[PASS] Backend server online & health check verified (status: healthy)\n');

  let passed = 0;
  let total = 0;

  async function testCase(name, fn) {
    total++;
    try {
      await fn();
      console.log(`[PASS] Test ${total}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] Test ${total}: ${name}`);
      console.error(`       Error: ${err.message}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Empty input rejection
    // -------------------------------------------------------------
    await testCase('Empty input rejection (empty payload and missing fields)', async () => {
      // Empty object
      const res1 = await makeRequest('POST', '/api/optimize', {});
      assert(res1.status === 400, `Expected 400 for empty object, got ${res1.status}`);
      assert(res1.json.code === 'VALIDATION_ERROR', `Expected VALIDATION_ERROR, got ${res1.json?.code}`);

      // Missing warehouse
      const res2 = await makeRequest('POST', '/api/optimize', {
        stops: ['C1'],
        nodes: testGraph.nodes,
        roads: testGraph.roads
      });
      assert(res2.status === 400, `Expected 400 for missing warehouse, got ${res2.status}`);
      assert(res2.json.code === 'VALIDATION_ERROR', `Expected VALIDATION_ERROR, got ${res2.json?.code}`);

      // Empty stops array
      const res3 = await makeRequest('POST', '/api/optimize', {
        warehouse: 'W',
        stops: [],
        nodes: testGraph.nodes,
        roads: testGraph.roads
      });
      assert(res3.status === 400, `Expected 400 for empty stops array, got ${res3.status}`);
      assert(res3.json.code === 'VALIDATION_ERROR', `Expected VALIDATION_ERROR, got ${res3.json?.code}`);
    });

    // -------------------------------------------------------------
    // Test 2: Invalid stop IDs
    // -------------------------------------------------------------
    await testCase('Invalid stop IDs rejection', async () => {
      const payload = {
        ...testGraph,
        stops: ['C1', 'NON_EXISTENT_CUSTOMER_STOP']
      };
      const res = await makeRequest('POST', '/api/optimize', payload);
      assert(res.status === 400, `Expected 400 for non-existent stop, got ${res.status}`);
      assert(res.json.code === 'VALIDATION_ERROR', 'Expected VALIDATION_ERROR');
      assert(
        res.json.error.includes('NON_EXISTENT_CUSTOMER_STOP'),
        `Error message should mention invalid stop ID: ${res.json.error}`
      );
    });

    // -------------------------------------------------------------
    // Test 3: Unreachable customer stops
    // -------------------------------------------------------------
    await testCase('Unreachable customer stop rejection from C++ engine', async () => {
      const unreachablePayload = {
        warehouse: 'W',
        stops: ['C1', 'ISLAND_NODE'],
        nodes: [
          ...testGraph.nodes,
          { id: 'ISLAND_NODE', name: 'Isolated Island Depot', lat: 37.8500, lng: -122.4500 }
        ],
        roads: testGraph.roads // Notice ISLAND_NODE has zero connected roads
      };
      const res = await makeRequest('POST', '/api/optimize', unreachablePayload);
      assert(res.status === 400, `Expected 400 for unreachable node, got ${res.status}`);
      assert(
        res.json.error.toLowerCase().includes('unreachable'),
        `Error should state unreachable: ${res.json.error}`
      );
    });

    // -------------------------------------------------------------
    // Test 4: Malformed JSON syntax
    // -------------------------------------------------------------
    await testCase('Malformed JSON syntax returns HTTP 400 Bad Request', async () => {
      const res = await makeRequest(
        'POST',
        '/api/optimize',
        '{ "warehouse": "W", "stops": [ invalid json syntax ...',
        { 'Content-Type': 'application/json' }
      );
      assert(res.status === 400, `Expected 400 for malformed json, got ${res.status}`);
      assert(res.json.code === 'JSON_SYNTAX_ERROR', `Expected JSON_SYNTAX_ERROR, got ${res.json?.code}`);
    });

    // -------------------------------------------------------------
    // Test 5: Repeated Clicks & Concurrent Requests
    // -------------------------------------------------------------
    await testCase('Repeated clicks and concurrent optimization requests', async () => {
      const concurrentCount = 5;
      const promises = [];
      for (let i = 0; i < concurrentCount; ++i) {
        promises.push(makeRequest('POST', '/api/optimize', testGraph));
      }
      const results = await Promise.all(promises);
      for (let i = 0; i < concurrentCount; ++i) {
        const res = results[i];
        assert(res.status === 200, `Concurrent request ${i + 1} failed with status ${res.status}`);
        assert(res.json.initialRoute.length === 5, 'Initial route length mismatch');
        assert(res.json.optimizedRoute.length === 5, 'Optimized route length mismatch');
        assert(
          res.json.optimizedDistance === results[0].json.optimizedDistance,
          'Deterministic result across concurrent runs'
        );
      }
    });

    // -------------------------------------------------------------
    // Test 6: Successful Optimization & Graph Edge Verification
    // -------------------------------------------------------------
    await testCase('Successful optimization and graph edge traversal verification', async () => {
      const res = await makeRequest('POST', '/api/optimize', testGraph);
      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
      const data = res.json;

      // 1. Initial route starts and ends at warehouse
      assert(data.initialRoute[0] === 'W', 'Initial tour must start at warehouse W');
      assert(
        data.initialRoute[data.initialRoute.length - 1] === 'W',
        'Initial tour must end at warehouse W'
      );

      // 2. Optimized route starts and ends at warehouse
      assert(data.optimizedRoute[0] === 'W', 'Optimized tour must start at warehouse W');
      assert(
        data.optimizedRoute[data.optimizedRoute.length - 1] === 'W',
        'Optimized tour must end at warehouse W'
      );

      // 3. Every customer visited
      testGraph.stops.forEach((stopId) => {
        assert(data.initialRoute.includes(stopId), `Initial tour missing stop ${stopId}`);
        assert(data.optimizedRoute.includes(stopId), `Optimized tour missing stop ${stopId}`);
      });

      // 4. Metric consistency
      assert(typeof data.initialDistance === 'number' && data.initialDistance > 0, 'initialDistance valid');
      assert(typeof data.optimizedDistance === 'number' && data.optimizedDistance > 0, 'optimizedDistance valid');
      assert(data.optimizedDistance <= data.initialDistance, '2-Opt must not increase distance');
      assert(
        Math.abs(data.distanceSaved - (data.initialDistance - data.optimizedDistance)) < 1e-4,
        'distanceSaved matches difference'
      );
      assert(
        Math.abs(data.improvementPercent - ((data.distanceSaved / data.initialDistance) * 100)) < 1e-3,
        'improvementPercent matches formula'
      );
      assert(typeof data.executionTimeMs === 'number' && data.executionTimeMs >= 0, 'executionTimeMs valid');

      // 5. Verify that each leg's pathNodes strictly follows actual graph road edges!
      const roadEdgeMap = new Map();
      testGraph.roads.forEach((r) => {
        const key1 = `${r.source}->${r.target}`;
        const key2 = `${r.target}->${r.source}`;
        roadEdgeMap.set(key1, r.distanceKm);
        roadEdgeMap.set(key2, r.distanceKm);
      });

      assert(Array.isArray(data.legs) && data.legs.length === data.optimizedRoute.length - 1, 'Legs count matches');

      let accumulatedLegDistance = 0;
      data.legs.forEach((leg, legIdx) => {
        assert(leg.pathNodes && leg.pathNodes.length >= 2, `Leg ${legIdx} has valid pathNodes`);
        assert(leg.from === data.optimizedRoute[legIdx], `Leg from matches route node`);
        assert(leg.to === data.optimizedRoute[legIdx + 1], `Leg to matches route node`);
        assert(leg.pathNodes[0] === leg.from, 'First node in pathNodes is leg from');
        assert(leg.pathNodes[leg.pathNodes.length - 1] === leg.to, 'Last node in pathNodes is leg to');

        // Check each step in pathNodes against true roads
        let legComputedDist = 0;
        for (let s = 0; s < leg.pathNodes.length - 1; ++s) {
          const u = leg.pathNodes[s];
          const v = leg.pathNodes[s + 1];
          const key = `${u}->${v}`;
          assert(roadEdgeMap.has(key), `Route step ${u} -> ${v} must exist in graph roads!`);
          legComputedDist += roadEdgeMap.get(key);
        }
        assert(
          Math.abs(legComputedDist - leg.distanceKm) < 1e-4,
          `Leg ${legIdx} distance (${leg.distanceKm}) matches edge weights (${legComputedDist})`
        );
        accumulatedLegDistance += leg.distanceKm;
      });

      assert(
        Math.abs(accumulatedLegDistance - data.optimizedDistance) < 1e-4,
        `Total leg distances (${accumulatedLegDistance}) match optimizedDistance (${data.optimizedDistance})`
      );

      // Verify coordinate geometries follow nodes
      const nodeCoordMap = new Map(testGraph.nodes.map((n) => [n.id, [n.lat, n.lng]]));
      data.legs.forEach((leg) => {
        assert(leg.coordinates.length === leg.pathNodes.length, 'Coordinates length matches pathNodes length');
        leg.pathNodes.forEach((nodeId, idx) => {
          const expectedCoord = nodeCoordMap.get(nodeId);
          const actualCoord = leg.coordinates[idx];
          assert(
            Math.abs(actualCoord[0] - expectedCoord[0]) < 1e-5 &&
            Math.abs(actualCoord[1] - expectedCoord[1]) < 1e-5,
            `Coordinate mismatch for node ${nodeId}`
          );
        });
      });
    });

  } finally {
    // Cleanly terminate backend test process
    serverProcess.kill('SIGTERM');
  }

  console.log('\n' + '='.repeat(70));
  console.log(`SUMMARY: ${passed} / ${total} End-to-End integration tests passed`);
  console.log('='.repeat(70) + '\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('[E2E FATAL ERROR]', err);
  process.exit(1);
});
