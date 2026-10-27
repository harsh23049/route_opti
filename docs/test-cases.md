# Test Cases & Verification Suite

The project is tested at four layers. All of them run with `npm test` and in CI (Linux and Windows):

| Layer | File | Runner | Command |
|---|---|---|---|
| C++ algorithm core | `algorithms/tests/test_algorithms.cpp` | CTest | `npm run test:cpp` |
| Backend API | `backend/tests/api.test.js` | `node:test` | `npm run test:backend` |
| Frontend graph utils | `frontend/src/utils/customStops.test.js` | `node:test` | `npm run test:frontend` |
| End-to-end | `scripts/e2e.test.js` | `node:test` | `npm run test:e2e` |

CI also runs the C++ suite under AddressSanitizer + UndefinedBehaviorSanitizer, and smoke-tests the Docker image.

---

## 1. C++ Engine (`ctest`)

CTest registers three tests:

| CTest name | What it runs |
|---|---|
| `algorithm_unit_tests` | `test_runner`: 15 suites, 601 assertions |
| `engine_cli_sample_input` | `optimizer_engine --file data/sample-input.json` must exit 0 |
| `engine_cli_missing_file_fails` | `optimizer_engine --file <missing>` must exit non-zero |

`test_runner` suites:

| # | Suite | Scenario | Invariant verified |
|---|---|---|---|
| 1 | `testDijkstraManuallyVerified` | 5-node graph where the direct edges are not the shortest | Distance 6.5 km, path `A-C-B-E-D`, street names |
| 2 | `testUnreachableVertices` | Disconnected island component | Unreachable point-to-point result; matrix build fails with "Unreachable location" |
| 3 | `testNearestNeighborProperties` | Ring graph with chords | Tour starts/ends at warehouse, each stop exactly once, distance equals the sum of legs |
| 4 | `testTwoOptNeverIncreasesCost` | Instance where NN produces a crossing | 2-Opt cost <= NN cost, depot fixed, each stop exactly once |
| 5 | `testAlreadyOptimalRoutes` | Triangle (only one tour exists) | Zero 2-Opt moves, zero savings |
| 6 | `testSmallAndInvalidInputs` | 0 and 1 stops, unknown warehouse/stop, negative weight, empty/duplicate IDs | Degenerate tours, descriptive errors, `std::invalid_argument` |
| 7 | `testBruteForceOptimalComparison` | 5 customers, 120 permutations | 2-Opt reaches the brute-force optimum |
| 8 | `testRouteUtilsExpansion` | Multi-hop legs | Full road path has no duplicated seam nodes |
| 9 | `testJsonInterfaceEndToEnd` | Valid, malformed and unreachable JSON payloads | Response schema and error responses |
| 10 | `testHeldKarpMatchesBruteForce` | 27 random instances with 0 to 8 customers | Held-Karp cost equals brute force; refuses above 15 stops |
| 11 | `testPipelineInvariantsRandom` | 30 random 12-stop instances | NN >= 2-Opt >= final >= optimum; final tour has no improving 2-Opt or Or-opt move |
| 12 | `testLocalSearchFromShuffledTours` | Random 30-stop tours in shuffled order | Or-opt and 2-Opt strictly improve, keep a valid tour, and end at a local optimum |
| 13 | `testRoadPathsAndEdgeValidation` | On-demand path rebuild; NaN / Infinity / negative edges | Correct reversed path, empty path for bad indices, edges rejected |
| 14 | `testStrictJsonSchema` | Missing `distance_km`, legacy aliases, object stops, `1e999` | Descriptive errors instead of silent defaults or crashes |
| 15 | `testJsonParserAndOptimalFields` | `-`, 10 000-deep nesting, `\u` escapes and surrogate pairs, 16-stop request | Parser errors (no crash), UTF-8 decoding, optimal fields present for small inputs and `null` above the limit |

Suite 11 also prints how often the heuristic reached the exact optimum (28/30, mean gap 0.04%).

---

## 2. Backend API (`backend/tests/api.test.js`)

17 tests. The Express app listens on a random port, and requests run against the real C++ engine.

| Group | Test | Expected |
|---|---|---|
| Health | Binary present, path not exposed | `200`, `executable.exists === true`, no `executable.path` |
| Health | CORS and headers | `Access-Control-Allow-Origin: http://localhost:3000`, no `X-Powered-By` |
| Engine | Sample graph (`data/sample-input.json`) | `5.45 -> 5.10 km`, exact routes, 5 legs, optimum `5.10`, gap `0`, stages `[5.45, 5.1, 5.1]` |
| Engine | Unreachable stop | `400 ALGORITHM_ERROR` |
| Engine | Job pool and queue full | `503 ENGINE_BUSY` |
| Validation | Missing warehouse | `400 VALIDATION_ERROR` |
| Validation | Unknown stop | `400`, message names the stop |
| Validation | Negative distance | `400`, "non-negative" |
| Validation | Missing `distance_km` | `400` (no silent 0 km road) |
| Validation | Legacy aliases `distanceKm`, `warehouseId`, `deliveryStops` | `400` |
| Validation | Object-shaped stops | `400` |
| Validation | `1e400` distance (Infinity after `JSON.parse`) | `400` |
| Validation | Latitude 91 | `400` |
| Validation | More than `MAX_STOPS` stops | `400` |
| Errors | Malformed JSON | `400 JSON_SYNTAX_ERROR` |
| Errors | 3 MB body | `413 PAYLOAD_TOO_LARGE` |
| Errors | Unknown API route | `404 NOT_FOUND` |

---

## 3. End-to-End (`scripts/e2e.test.js`)

Starts `backend/src/app.js` as a separate process on a free port, so each request goes through HTTP, Express and a spawned engine process.

| # | Test | Assertions |
|---|---|---|
| E2E-01 | Empty input | `{}`, missing warehouse and empty `stops` all return `400 VALIDATION_ERROR` |
| E2E-02 | Unknown stop IDs | `400`, message names the ID |
| E2E-03 | Unreachable stop | `400 ALGORITHM_ERROR` mentioning "unreachable" |
| E2E-04 | Malformed JSON | `400 JSON_SYNTAX_ERROR` |
| E2E-05 | 8 concurrent requests (repeated clicks) | All `200`, identical distances |
| E2E-06 | Full response check | All three routes (initial, optimized, optimal) start and end at the warehouse and visit every stop; `optimal <= optimized <= initial`; saved/percent formulas hold; **every step of every leg is a real road**, leg lengths equal their edge sums, legs sum to the tour distance, coordinates match the nodes |
