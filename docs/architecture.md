# Smart Delivery Route Optimization — Architecture

## 1. Project Overview & Constraints
This project is an academic Algorithms mini-project focused on demonstrating classical graph and heuristic optimization techniques applied to vehicle parcel delivery.

### Key Constraints:
- **No Database:** In-memory graph structures and JSON data sources.
- **No Authentication:** Direct single-user interactive dashboard.
- **No External Map APIs:** Fully simulated city road map rendered in native SVG.
- **No AI/ML:** Deterministic algorithms (Dijkstra, Nearest Neighbor, 2-Opt, Or-opt, Held-Karp).

---

## 2. Monorepo Components

### `algorithms/` (C++17 Engine)
- **Role:** Graph traversal and TSP route optimization.
- **Build System:** CMake 3.16+, warnings enabled (`-Wall -Wextra -Wpedantic` / `/W4`), optional `-Werror` and ASan/UBSan builds.
- **Core Algorithms:**
  - **Dijkstra's Algorithm:** Shortest road paths from every stop; predecessor trees rebuild legs on demand.
  - **Nearest Neighbor Heuristic:** Greedy initial delivery tour construction.
  - **2-Opt and Or-opt Local Search:** Segment reversal and segment relocation until neither improves.
  - **Held-Karp DP:** Exact optimum for up to 15 stops, reported as the optimality gap.
  - **Fleet split:** With several vans, a split DP cuts the best tour into one route per van (minimizing the longest), then an inter-route relocate pass balances them.
- **Interface:** One JSON request on stdin, one JSON response on stdout, exit code mirrors success (see `docs/json-interface.md`).

### `backend/` (Node.js + Express API)
- **Role:** API gateway between the frontend and the C++ engine.
- **Responsibilities:**
  - Validates the strict request schema and size limits (the trust boundary).
  - Runs the engine through `child_process.spawn` (no shell), with a bounded job pool, wait queue and timeout.
  - Maps engine and request errors to HTTP status codes (`400`/`413`/`503`/`504`/`500`) without leaking server internals.
  - Serves the built frontend in production, so the app runs on a single port.

### `frontend/` (React + Vite + Tailwind CSS)
- **Role:** Interactive operator dashboard.
- **Responsibilities:**
  - Renders the map in native SVG: real-city presets on Web Mercator map tiles (Esri World Light Gray Canvas), the teaching graphs on an illustrated basemap.
  - Loads real-city presets (`public/cities/*.json`, built from OpenStreetMap by `scripts/build-city-presets.mjs`) on first use.
  - Lets the user choose or add delivery stops, pick 1 to 5 vans, and compare the before route with the optimized (and, for one van, the optimal) route.
  - Shows metrics (distance, savings, optimality gap, per-van lengths, engine latency) and replays all vans driving at once.

### `data/`
- `sample-input.json` / `sample-output.json`: a request and the engine's real response, used by tests and docs.

### `scripts/`
- `e2e.test.js`: end-to-end tests against a separately started backend process.
- `benchmark.js`: seeded random-city benchmark (NN vs 2-Opt vs Or-opt vs optimum, latency).
- `build-city-presets.mjs`: downloads OpenStreetMap roads and places from the Overpass API and writes the real-city presets.

### `docs/`
- Algorithm design and complexity, JSON interface, and test catalog.

---

## 3. Request Flow

```
Browser ──POST /api/optimize──▶ Express
                                  │ validate schema + limits (400/413)
                                  │ acquire engine slot (queue, 503 when full)
                                  ▼
                         spawn optimizer_engine ──stdin JSON──▶ C++ pipeline
                                  ◀──stdout JSON── (timeout → kill, 504)
                                  │ success:false → 400 ALGORITHM_ERROR
                                  ▼
Browser ◀────────── JSON (routes, legs, coordinates, metrics)
```

## 4. Deployment

- **Docker:** a multi-stage `Dockerfile` builds and tests the engine, builds the frontend, and ships a `node:24-bookworm-slim` runtime that runs as a non-root user with a health check on port 8080.
- **CI:** GitHub Actions builds and tests on Linux and Windows, lints, runs the C++ tests under sanitizers, and smoke-tests the Docker image.
