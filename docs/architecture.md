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
  - Renders the simulated street network and nodes in native SVG.
  - Lets the user choose delivery stops and compare the Nearest Neighbor, optimized and optimal routes.
  - Shows metrics (distance, savings, optimality gap, engine latency) and replays vehicle progress.

### `data/`
- `sample-input.json` / `sample-output.json`: a request and the engine's real response, used by tests and docs.

### `scripts/`
- `e2e.test.js`: end-to-end tests against a separately started backend process.
- `benchmark.js`: seeded random-city benchmark (NN vs 2-Opt vs Or-opt vs optimum, latency).

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
