# Smart Delivery Route Optimization

A college Algorithms mini-project demonstrating graph traversal and combinatorial route optimization algorithms for simulated urban parcel delivery.

Integrates a **C++17 algorithmic engine**, a **Node.js Express API bridge**, and an **interactive React + Vite frontend** with native SVG map rendering.

---

## Architecture & Integration Pipeline

```
┌─────────────────────────────────┐
│   React + Vite Frontend (UI)    │  Port 3000
│  - Native SVG simulated city    │
│  - Presets & Stop selector      │
│  - Metric cards (distances, %)  │
└────────────────┬────────────────┘
                 │ HTTP POST /api/optimize (JSON graph, warehouse, stops)
                 ▼
┌─────────────────────────────────┐
│    Node.js Express Backend      │  Port 5001
│  - Input validation             │
│  - Process safety & timeouts    │
│  - child_process.spawn IPC      │
└────────────────┬────────────────┘
                 │ stdin / stdout (Structured JSON streams)
                 ▼
┌─────────────────────────────────┐
│       C++17 Core Engine         │  `optimizer_engine` binary
│  1. Undirected Graph (Adj List) │
│  2. Dijkstra All-Pairs Matrix   │
│  3. Nearest Neighbor TSP tour   │
│  4. 2-Opt Local Search (O(1))   │
│  5. Path Node & Coord Expansion │
└─────────────────────────────────┘
```

- **Zero External Map Cloud APIs:** All road geometry and paths are derived strictly from graph edges.
- **Zero Database / Auth:** Pure algorithmic pipeline.
- **Safe Process Spawning:** C++ binary invoked with fixed path and piped streams (no shell concatenation).
- **Diagnostics Separation:** Pure JSON on `stdout`; logs and diagnostics to `stderr`.

---

## Monorepo Layout

```
route_opti/
├── algorithms/                 # C++17 optimization engine (CMake)
│   ├── include/                # Graph, Dijkstra, DistanceMatrix, NearestNeighbor, TwoOpt, Json
│   ├── src/                    # Implementation modules & JSON CLI runner
│   ├── tests/                  # CTest test suite with brute-force TSP solver comparison
│   └── CMakeLists.txt
├── backend/                    # Express API server
│   ├── src/
│   │   ├── app.js              # Express app & server entry
│   │   ├── config.js           # Environment & binary path configuration
│   │   ├── routes/             # POST /api/optimize & GET /api/health
│   │   ├── services/           # C++ spawn runner
│   │   └── validators/         # Graph & request validation
│   ├── tests/                  # Automated backend integration tests
│   └── package.json
├── frontend/                   # React + Vite + Tailwind CSS dashboard
│   ├── src/
│   │   ├── components/         # CityMap (SVG), MetricCards, RouteControls, StopItinerary
│   │   ├── data/               # City graph presets
│   │   └── services/           # Axios API client
│   └── package.json
├── scripts/
│   └── e2e-test.js             # Automated End-to-End integration test suite
├── package.json                # Root monorepo build & test automation
└── README.md                   # Project documentation
```

---

## Quick Start (Root Commands)

Ensure you have CMake (>= 3.14), a C++17 compiler (Clang/GCC), and Node.js (>= 18) installed.

### 1. Build Everything
```bash
# Build the C++ optimization target
npm run build:cpp

# Build frontend production bundle
npm run build:frontend
```

### 2. Run All Automated Tests
```bash
# Executes C++ ctest suite, backend test suite, and end-to-end integration tests
npm test
```

### 3. Start Development Servers
Run the backend and frontend in separate terminals:

**Terminal 1 — Express Backend API (Port 5001):**
```bash
npm run dev:backend
```

**Terminal 2 — React Frontend (Port 3000):**
```bash
npm run dev:frontend
```

Open your browser at **`http://localhost:3000`**.

---

## Automated Test Suites

### 1. C++ Engine Tests (`ctest`)
Run `npm run test:cpp` (or `ctest --test-dir algorithms/build --output-on-failure`).
- 106 automated assertions:
  - Dijkstra shortest path correctness and node reconstruction.
  - Unreachable node detection.
  - Symmetric distance matrix verification.
  - Nearest Neighbor tour invariants (starts/ends at warehouse, visits every customer once).
  - 2-Opt cost non-increase invariant ($\text{cost}_{\text{2-opt}} \le \text{cost}_{\text{NN}}$).
  - Brute-force reference solver comparison on small graphs.
  - C++ JSON serialization and error handling.

### 2. Backend API Tests (`npm run test:backend`)
Run `npm run test:backend`.
- 9 test cases verifying:
  - `GET /api/health` status and binary existence.
  - CORS headers restricted to frontend origin.
  - Successful optimization returning C++ metrics.
  - Rejection of missing warehouse, invalid stops, negative edge weights.
  - C++ process error handling for unreachable nodes.
  - Malformed JSON rejection.

### 3. End-to-End Integration Suite (`npm run test:e2e`)
Run `npm run test:e2e` (or `node scripts/e2e-test.js`).
- Starts a dedicated backend server process on test port 5099 and validates:
  1. **Empty input rejection:** Missing fields and empty payload return HTTP 400.
  2. **Invalid stop IDs:** Non-existent node references return HTTP 400.
  3. **Unreachable customer stops:** Disconnected graph nodes return HTTP 400 with diagnostic message.
  4. **Malformed JSON:** Malformed syntax triggers HTTP 400 `JSON_SYNTAX_ERROR`.
  5. **Repeated clicks & concurrency:** 5 simultaneous requests process cleanly and deterministically.
  6. **Graph edge verification:**
     - Start and end nodes match warehouse ID.
     - All customer stops visited.
     - Every leg's `pathNodes` step-by-step strictly traverses edges present in the input graph.
     - Cumulative leg distances match the returned distance metrics.
     - Coordinates match input node definitions.

---

## API Specification

### `POST /api/optimize`

#### Request Payload:
```json
{
  "warehouse": "W",
  "stops": ["S1", "S2", "S3"],
  "nodes": [
    { "id": "W", "name": "Warehouse", "lat": 37.7749, "lng": -122.4194 },
    { "id": "S1", "name": "Customer 1", "lat": 37.7850, "lng": -122.4100 },
    { "id": "S2", "name": "Customer 2", "lat": 37.7650, "lng": -122.4200 },
    { "id": "S3", "name": "Customer 3", "lat": 37.7700, "lng": -122.4000 }
  ],
  "roads": [
    { "source": "W", "target": "S1", "distance_km": 1.5, "street_name": "Main St" },
    { "source": "S1", "target": "S2", "distance_km": 2.1, "street_name": "Market St" },
    { "source": "S2", "target": "S3", "distance_km": 1.8, "street_name": "Broadway" },
    { "source": "S3", "target": "W", "distance_km": 2.0, "street_name": "Expressway" }
  ]
}
```

#### Response Payload (HTTP 200):
```json
{
  "initialRoute": ["W", "S1", "S2", "S3", "W"],
  "optimizedRoute": ["W", "S1", "S3", "S2", "W"],
  "initialDistance": 7.4,
  "optimizedDistance": 6.8,
  "distanceSaved": 0.6,
  "improvementPercent": 8.11,
  "executionTimeMs": 0.42,
  "legs": [
    {
      "from": "W",
      "to": "S1",
      "distanceKm": 1.5,
      "pathNodes": ["W", "S1"],
      "coordinates": [[37.7749, -122.4194], [37.7850, -122.4100]]
    }
  ],
  "fullRoadPath": ["W", "S1", "S3", "S2", "W"],
  "fullCoordinates": [[37.7749, -122.4194], [37.7850, -122.4100], ...]
}
```
