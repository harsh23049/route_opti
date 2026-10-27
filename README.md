# Smart Delivery Route Optimization

> **College Algorithms Mini-Project**  
> *A multi-tier implementation of graph shortest paths, TSP heuristics, local search and exact dynamic programming for urban package delivery.*

[![CI](https://github.com/harsh23049/route_opti/actions/workflows/ci.yml/badge.svg)](https://github.com/harsh23049/route_opti/actions/workflows/ci.yml)
[![C++17](https://img.shields.io/badge/C%2B%2B-17-blue.svg)](https://en.cppreference.com/w/cpp/17)
[![Node](https://img.shields.io/badge/Node-%E2%89%A522-339933.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://react.dev/)

---

## 1. Problem Statement

A delivery vehicle leaves a central depot, visits a set of customer locations on a city road network, and returns to the depot. The goal is the shortest total road distance.

Formally, this is the **Metric Traveling Salesperson Problem (TSP)** over the shortest-path metric of an undirected road graph $G = (V, E, w)$. TSP is **NP-hard**, so the engine combines exact and heuristic methods:

1. **Dijkstra's algorithm** computes exact shortest road distances and turn-by-turn paths between all points of interest.
2. **Nearest Neighbor** builds an initial closed tour from the depot.
3. **2-Opt local search** untangles crossings by reversing tour segments.
4. **Or-opt local search** relocates segments of 1 to 3 stops. It alternates with 2-Opt until neither improves the tour.
5. **Held-Karp dynamic programming** computes the exact optimum for up to 15 stops. The response reports how far the heuristic is from optimal.

---

## 2. Key Features

- **Pure algorithmic core:** no external map APIs. Every road and route geometry comes from the input graph.
- **Native SVG city map:** roads drawn from the graph edges, depot and numbered stop markers, route polylines and an animated vehicle.
- **Three-way route comparison:** Nearest Neighbor vs optimized (2-Opt + Or-opt) vs exact optimum (Held-Karp).
- **Live metrics:** initial and optimized distance, distance saved, improvement %, optimality gap and engine latency.
- **Safe process boundary:** Express runs the compiled C++ engine with `child_process.spawn` (no shell), passing JSON over stdin/stdout, with a bounded job pool, wait queue and timeout.
- **Strict validation:** one request schema with no aliases, finite non-negative distances, coordinate ranges, and size limits on nodes, roads, stops and body.
- **Tested on Linux and Windows in CI:** C++ unit and property tests (also under ASan/UBSan), API tests, end-to-end tests, lint, and a Docker smoke test.

---

## 3. Assumptions & Theoretical Foundations

### 3.1. Graph Assumptions
1. **Undirected road network:** every street segment has the same length in both directions ($w(u, v) = w(v, u)$).
2. **Non-negative, finite edge distances:** $0 \le w(e) < \infty$, as Dijkstra requires.
3. **Metric distances:** the shortest-path distance is symmetric and satisfies the triangle inequality.

### 3.2. Heuristics vs Global Optimum
- **Nearest Neighbor** is greedy. It can be forced into long return legs and **does not guarantee the optimum**.
- **2-Opt** and **Or-opt** stop at a **local optimum** of their neighborhoods. They **do not guarantee the global optimum** either.
- **Held-Karp** is exact but exponential ($O(2^n n^2)$). It runs only for $n \le 15$ stops and serves as ground truth for the heuristics. See the benchmark below.

---

## 4. System Architecture

```
┌────────────────────────────────────────────────────────┐
│               Frontend: React + Vite                   │
│   - Interactive SVG city road network map              │
│   - Stop selection, route comparison, playback         │
│   - Metric cards & dispatch itinerary                  │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP POST /api/optimize (JSON)
                            ▼
┌────────────────────────────────────────────────────────┐
│             Backend: Node.js + Express                 │
│   - Strict schema + size limits (trust boundary)       │
│   - Bounded engine job pool, queue, timeout            │
│   - Error → HTTP status mapping, static UI in prod     │
└───────────────────────────┬────────────────────────────┘
                            │ stdin / stdout (one JSON document each)
                            ▼
┌────────────────────────────────────────────────────────┐
│         C++17 Engine: optimizer_engine                 │
│   1. Graph adjacency list                              │
│   2. Dijkstra from every stop → distance matrix        │
│   3. Nearest Neighbor tour construction                │
│   4. 2-Opt + Or-opt local search (O(1) move deltas)    │
│   5. Held-Karp exact optimum (≤ 15 stops)              │
│   6. Road-level path and coordinate expansion          │
└────────────────────────────────────────────────────────┘
```

More detail: [docs/architecture.md](docs/architecture.md).

---

## 5. Time & Space Complexity

Let $|V|$ = intersections, $|E|$ = road segments, $K = |C| + 1$ = stops including the depot, $n = K - 1$.

| Phase | Algorithm | Time | Space |
|---|---|---|---|
| Graph modeling | Adjacency list | $O(\|V\| + \|E\|)$ | $O(\|V\| + \|E\|)$ |
| Shortest paths | Dijkstra (binary heap), once per stop | $O(K (\|V\| + \|E\|) \log \|V\|)$ | $O(K \cdot \|V\|)$ predecessor trees |
| Tour construction | Nearest Neighbor | $O(K^2)$ | $O(K)$ |
| Tour improvement | 2-Opt, Or-opt | $O(K^2)$ per pass / move | $O(K)$ |
| Exact reference | Held-Karp | $O(2^n n^2)$, only $n \le 15$ | $O(2^n n)$ |
| Path expansion | Leg concatenation | $O(L)$, $L$ = road nodes on the route | $O(L)$ |

Full derivations: [docs/algorithm-design.md](docs/algorithm-design.md).

---

## 6. Benchmark

`npm run bench` builds seeded random 20×20 grid cities (400 intersections, roads 0–30% longer than straight lines) and runs the engine 10 times per row:

| Stops | NN (km) | + 2-Opt (km) | + Or-opt (km) | Improvement % | Optimal (km) | Gap to optimal % | Optimal found | Engine ms (median) |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 5 | 25.26 | 23.87 | 23.87 | 5.9 | 23.87 | 0.00 | 10/10 | 3.42 |
| 10 | 37.07 | 33.79 | 33.28 | 9.5 | 33.27 | 0.02 | 9/10 | 3.99 |
| 15 | 43.15 | 38.65 | 38.30 | 10.9 | 37.99 | 0.87 | 6/10 | 18.23 |
| 25 | 55.73 | 47.97 | 47.28 | 15.2 | — | — | — | 4.22 |
| 50 | 76.92 | 66.41 | 64.32 | 16.0 | — | — | — | 5.32 |
| 100 | 107.99 | 91.04 | 86.21 | 19.8 | — | — | — | 8.40 |

Takeaways: local search saves 6–20% over Nearest Neighbor, and the savings grow with the number of stops. Where the optimum is computable, the final tour is within 1% of it. The 15-stop row is the slowest because Held-Karp's $2^{15}$ states dominate. (Measured on a Windows laptop; absolute times vary by machine.)

---

## 7. Monorepo Structure

```
route_opti/
├── algorithms/                 # C++17 optimization engine (CMake)
│   ├── include/ src/           # Graph, Dijkstra, DistanceMatrix, NearestNeighbor, TwoOpt,
│   │                           # OrOpt, HeldKarp, Optimizer, Json, JsonInterface, main
│   ├── tests/                  # CTest suite (unit + randomized property tests)
│   └── CMakeLists.txt
├── backend/                    # Express API (bridge to the engine)
│   ├── src/                    # app.js, config.js, routes/, services/cppRunner.js, validators/
│   └── tests/api.test.js       # node:test API tests
├── frontend/                   # React + Vite + Tailwind dashboard
├── data/                       # sample-input.json and the engine's sample-output.json
├── docs/                       # algorithm design, JSON interface, architecture, test catalog
├── scripts/                    # e2e.test.js, benchmark.js
├── .github/                    # CI workflow, Dependabot
├── Dockerfile
└── package.json                # npm workspaces root (backend, frontend)
```

---

## 8. Setup & Prerequisites

- **C++17 compiler:** GCC 9+, Clang 10+, or MSVC 2019+ (Visual Studio Build Tools on Windows)
- **CMake** 3.16+
- **Node.js** 22+ (npm 10+)

```bash
npm ci                 # installs backend + frontend + tooling (npm workspaces, one lockfile)
npm run build:cpp      # builds algorithms/build/optimizer_engine(.exe)
```

> **Windows:** run the commands from a "Developer PowerShell for VS" (or any shell with CMake and MSVC on `PATH`). The build always places the binary at `algorithms/build/optimizer_engine.exe`, where the backend expects it.

---

## 9. Running

### Development (two terminals)
```bash
npm run dev:backend    # API on http://localhost:5001 (restarts on change)
npm run dev:frontend   # UI on http://localhost:3000 (proxies /api to :5001)
```

### Production (single port)
```bash
npm run build:frontend
npm start              # serves the UI and the API on http://localhost:5001
```

### Docker
```bash
docker build -t route-opti .
docker run -p 8080:8080 route-opti     # http://localhost:8080
```
The image builds and tests the engine, builds the UI, and runs as a non-root user with a health check.

### Engine CLI
```bash
algorithms/build/optimizer_engine --file data/sample-input.json
algorithms/build/optimizer_engine --demo
```
See [docs/json-interface.md](docs/json-interface.md) for modes and exit codes.

### Configuration (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5001` | API port |
| `FRONTEND_URL` | `http://localhost:3000` | Allowed CORS origin (dev server) |
| `CPP_EXECUTABLE_PATH` | `algorithms/build/optimizer_engine[.exe]` | Engine binary |
| `STATIC_DIR` | `frontend/dist` | Built UI to serve (skipped if missing) |
| `EXECUTION_TIMEOUT_MS` | `5000` | Engine run time limit (504 after this) |
| `MAX_CONCURRENT_JOBS` | CPU count | Parallel engine processes |
| `MAX_QUEUED_JOBS` | `32` | Requests waiting for a slot (503 beyond this) |
| `MAX_BODY_SIZE` | `2mb` | Request body limit (413 beyond this) |
| `MAX_NODES` / `MAX_ROADS` / `MAX_STOPS` | `5000` / `20000` / `100` | Graph size limits (400 beyond these) |

---

## 10. API Example

`POST /api/optimize` with [data/sample-input.json](data/sample-input.json) (the "Downtown Metro Grid" graph, 4 stops):

```json
{
  "warehouse": "node_0",
  "stops": ["node_1", "node_2", "node_3", "node_4"],
  "nodes": [
    { "id": "node_0", "name": "Central Logistics Hub", "lat": 37.7830, "lng": -122.4080 },
    { "id": "j_1", "name": "Market & 3rd Junction", "lat": 37.7880, "lng": -122.4030 }
  ],
  "roads": [
    { "source": "node_0", "target": "j_1", "distance_km": 0.85, "street_name": "Hub Main Way" }
  ]
}
```
*(nodes and roads shortened here; see the file for the full graph)*

Response excerpt (full: [data/sample-output.json](data/sample-output.json)):

```json
{
  "success": true,
  "initialRoute":   ["node_0", "node_1", "node_2", "node_3", "node_4", "node_0"],
  "optimizedRoute": ["node_0", "node_2", "node_1", "node_3", "node_4", "node_0"],
  "initialDistance": 5.45,
  "optimizedDistance": 5.1,
  "distanceSaved": 0.35,
  "improvementPercent": 6.42201834862,
  "optimalDistance": 5.1,
  "optimalityGapPercent": 0,
  "stages": [
    { "algorithm": "Nearest Neighbor", "distanceKm": 5.45 },
    { "algorithm": "2-Opt", "distanceKm": 5.1 },
    { "algorithm": "Or-opt", "distanceKm": 5.1 }
  ],
  "legs": [
    { "from": "node_0", "to": "node_2", "distanceKm": 1.55,
      "pathNodes": ["node_0", "j_1", "node_2"],
      "coordinates": [[37.783, -122.408], [37.788, -122.403], [37.794, -122.402]] }
  ]
}
```

2-Opt reverses the `node_1 → node_2` segment of the greedy tour and saves 0.35 km (6.42%). Held-Karp confirms that 5.10 km is optimal. The optimal route printed is the same tour driven in the opposite direction.

---

## 11. Testing

```bash
npm test               # C++ (ctest) + backend API (node:test) + end-to-end (node:test)
npm run lint           # ESLint for backend, scripts and frontend
npm run bench          # benchmark table above
```

| Suite | Scope |
|---|---|
| C++ `ctest` | 15 suites / 601 assertions: Dijkstra, unreachable nodes, NN/2-Opt/Or-opt invariants, Held-Karp vs brute force, randomized property tests, strict JSON schema, parser robustness. Also CLI exit-code tests |
| Backend API | 17 tests: validation (aliases, Infinity, limits), error mapping (400/404/413/503), real engine results |
| End-to-end | 6 tests against a separately started server: concurrency, and **every leg of every route follows real road edges** |

CI also runs the C++ tests under ASan + UBSan and smoke-tests the Docker image. Full catalog: [docs/test-cases.md](docs/test-cases.md).

---

## 12. Known Limitations

1. **Static graph:** traffic, turn penalties and one-way streets are not modeled. Directed edges would break the symmetric $O(1)$ 2-Opt delta, which assumes $D[u][v] = D[v][u]$.
2. **Heuristic above 15 stops:** the optimality gap is reported only where Held-Karp is feasible.
3. **Single vehicle:** one vehicle with unlimited capacity. Multi-vehicle routing with capacities or time windows (VRP / VRPTW) is out of scope.

---

## 13. Instructions for Report Screenshots

1. **Dashboard overview:** open `http://localhost:3000`, pick **"Downtown Metro Grid"** with the default stops (S1–S4). Capture the header (status "API Connected • C++ Ready"), metric cards, map, controls and itinerary.
2. **Optimization result:** click **"Optimize Route"**. Capture the route on the map and the metric cards: 0.35 km saved, 6.4% improvement, 0% optimality gap.
3. **Algorithm comparison:** switch the route view between **Nearest Neighbor**, **Optimized** and **Optimal** to show the segment reversal.
4. **Custom stops:** click map nodes to add or remove stops, then optimize again.
5. **Simulation replay:** press Play on the playback scrubber to show the animated vehicle.
6. **Benchmark & tests:** run `npm run bench` and `npm test` and capture the terminal output.
