# Test Cases & Verification Suite

This document catalogs the test cases, verification methodologies, and test harness execution for the **Smart Delivery Route Optimization** project across all three architectural layers:
1. **C++ Algorithm Core Tests** (`ctest` / `test_runner`)
2. **Backend API Integration Tests** (`npm test` in `backend/`)
3. **End-to-End System Tests** (`node scripts/e2e-test.js`)

---

## 1. C++ Engine Test Suite (`test_algorithms.cpp`)

Located at [algorithms/tests/test_algorithms.cpp](file:///Users/harshdeepsingh/Desktop/route_opti/algorithms/tests/test_algorithms.cpp). Executed with:
```bash
ctest --test-dir algorithms/build --output-on-failure
```
Total Assertions: **106 automated checks** covering 8 distinct test suites.

| Suite ID | Test Name | Purpose / Scenario Tested | Invariant Verified |
|---|---|---|---|
| **CPP-01** | `testGraphBuilding` | Adjacency list construction, edge addition, node lookups | Non-negative edge rejection, vertex count correctness |
| **CPP-02** | `testDijkstraShortestPath` | Dijkstra shortest path on known triangle and multi-hop grid | Distance matches manual calculation, path reconstruction |
| **CPP-03** | `testUnreachableNodeDetection` | Disconnected node with no edges to warehouse | Distance is `INFINITY`, path is empty, matrix build throws error |
| **CPP-04** | `testDistanceMatrix` | All-pairs shortest path matrix between warehouse and stops | Matrix symmetry ($D[u][v] = D[v][u]$), zero diagonal ($D[u][u]=0$) |
| **CPP-05** | `testNearestNeighborProperties` | Greedy tour construction starting and ending at warehouse | Tour starts at $w_0$, ends at $w_0$, visits every stop exactly once |
| **CPP-06** | `testTwoOptOptimization` | 2-Opt local search on crossing tour | $\text{cost}_{\text{2-opt}} \le \text{cost}_{\text{NN}}$, depot endpoints fixed |
| **CPP-07** | `testBruteForceOptimalComparison` | Compares 2-opt tour cost against brute-force reference TSP solver on small graph | 2-opt finds valid tour within bounded approximation ratio |
| **CPP-08** | `testJsonInterfacePipeline` | End-to-end JSON serialization, leg extraction, error handling | Valid JSON syntax, leg geometries match node coordinates |

---

## 2. Backend Express API Test Suite (`backendTests.js`)

Located at [backend/tests/backendTests.js](file:///Users/harshdeepsingh/Desktop/route_opti/backend/tests/backendTests.js). Executed with:
```bash
npm test --prefix backend
```
Total Test Cases: **9 automated tests**.

| Test ID | Method & Endpoint | Input Scenario | Expected Status & Behavior |
|---|---|---|---|
| **API-01** | `GET /api/health` | Standard health probe | Status `200 OK`, `executable.exists === true` |
| **API-02** | `OPTIONS /api/optimize` | CORS preflight request | `Access-Control-Allow-Origin: http://localhost:3000` |
| **API-03** | `POST /api/optimize` | Valid sample city graph (W + 3 customer stops) | Status `200 OK`, valid C++ metrics returned on stdout |
| **API-04** | `POST /api/optimize` | Missing `warehouse` attribute in payload | Status `400 Bad Request`, `code: "VALIDATION_ERROR"` |
| **API-05** | `POST /api/optimize` | Non-existent customer stop ID in `stops` | Status `400 Bad Request`, mentions invalid stop ID |
| **API-06** | `POST /api/optimize` | Negative edge distance ($w = -1.5$) | Status `400 Bad Request`, rejects negative weight |
| **API-07** | `POST /api/optimize` | Disconnected stop with no path from depot | Status `400 Bad Request`, C++ stderr captured with unreachable message |
| **API-08** | `POST /api/optimize` | Malformed JSON syntax (broken braces) | Status `400 Bad Request`, `code: "JSON_SYNTAX_ERROR"` |
| **API-09** | `GET /api/unknown-endpoint`| Non-existent route | Status `404 Not Found`, `code: "NOT_FOUND"` |

---

## 3. End-to-End System Test Suite (`scripts/e2e-test.js`)

Located at [scripts/e2e-test.js](file:///Users/harshdeepsingh/Desktop/route_opti/scripts/e2e-test.js). Executed with:
```bash
npm run test:e2e
```
Starts a dedicated instance of the Express backend on test port 5099 and verifies the full stack integration.

### Test Case Breakdown:

### Test E2E-01: Empty Input Rejection
- **Input:** `{}` (empty JSON object), `{ stops: ['C1'] }` (missing warehouse), `{ warehouse: 'W', stops: [] }` (empty stops array).
- **Assertion:** Returns HTTP `400 Bad Request` with `code: "VALIDATION_ERROR"`.

### Test E2E-02: Invalid Stop IDs Rejection
- **Input:** `stops: ['C1', 'NON_EXISTENT_CUSTOMER_STOP']`.
- **Assertion:** Returns HTTP `400 Bad Request` with message explicitly naming the missing ID.

### Test E2E-03: Unreachable Customer Stops
- **Input:** Graph with disconnected island node `ISLAND_NODE` having degree 0.
- **Assertion:** C++ engine detects infinite distance and returns HTTP `400 Bad Request` containing `"unreachable"`.

### Test E2E-04: Malformed JSON Syntax
- **Input:** Raw invalid string `'{ "warehouse": "W", "stops": [ invalid json syntax ...'`.
- **Assertion:** Express middleware intercepts syntax error and returns HTTP `400 Bad Request` with `code: "JSON_SYNTAX_ERROR"`.

### Test E2E-05: Repeated Clicks & Concurrency
- **Input:** 5 simultaneous asynchronous `POST /api/optimize` requests fired concurrently.
- **Assertion:** All 5 requests succeed with HTTP `200 OK` and return deterministic, identical route metrics without process race conditions.

### Test E2E-06: Successful Optimization & Graph Edge Verification
- **Input:** Complete road graph with warehouse `W` and customers `C1`, `C2`, `C3`.
- **Assertions:**
  1. **Cycle Start/End:** Initial and optimized routes start and end at `W`.
  2. **Completeness:** Every stop in `stops` appears in both tours.
  3. **Metric Formulas:**
     - $\text{dist}_{\text{opt}} \le \text{dist}_{\text{init}}$
     - $\text{saved} = \text{dist}_{\text{init}} - \text{dist}_{\text{opt}}$
     - $\text{improvement} = (\text{saved} / \text{dist}_{\text{init}}) \times 100\%$
     - $\text{executionTimeMs} \ge 0$
  4. **Strict Graph Road Edge Conformance:**
     - For every leg in `legs`, each step $(p_i, p_{i+1})$ in `leg.pathNodes` is looked up in the input `roads` array.
     - The sum of actual edge distances for that leg matches `leg.distanceKm`.
     - The sum of all leg distances matches `optimizedDistance`.
  5. **Coordinate Integrity:** Every coordinate pair in `leg.coordinates` matches the exact latitude/longitude of the corresponding node in `nodes`.

---

## 4. Test Execution Summary

| Test Layer | Harness | Tests Executed | Passed | Failed |
|---|---|---|---|---|
| **Algorithms (C++)** | `ctest` | 1 test (106 assertions) | 106 | 0 |
| **Backend API** | Node.js Test Harness | 9 endpoint scenarios | 9 | 0 |
| **End-to-End System** | HTTP E2E Test Suite | 6 multi-step integration tests | 6 | 0 |
| **Total** | Full Suite (`npm test`) | **All Tests** | **100% Pass** | **0 Failures** |
