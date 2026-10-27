# Smart Delivery Route Optimization — Architecture

## 1. Project Overview & Constraints
This project is an academic Algorithms mini-project focused on demonstrating classical graph and heuristic optimization techniques applied to vehicle parcel delivery.

### Key Constraints:
- **No Database:** In-memory graph structures and JSON data sources.
- **No Authentication:** Direct single-user interactive dashboard.
- **No External Map APIs:** Fully simulated city road map rendered in native SVG.
- **No AI/ML:** Deterministic and heuristic algorithmic methods (Dijkstra, Nearest Neighbor, 2-Opt local search).

---

## 2. Monorepo Components

### `algorithms/` (C++17 Engine)
- **Role:** High-performance graph traversal and TSP/route optimization.
- **Build System:** CMake (standard C++17, cross-platform).
- **Core Algorithms:**
  - **Dijkstra's Algorithm:** All-pairs and point-to-point shortest road paths.
  - **Nearest Neighbor Heuristic:** Greedy initial delivery tour construction.
  - **2-Opt Local Search:** Iterative edge-swap tour improvement to eliminate path crossings.

### `backend/` (Node.js + Express API)
- **Role:** Lightweight API gateway between frontend and C++ engine.
- **Responsibilities:**
  - Validates delivery stops and network inputs.
  - Invokes compiled C++ optimizer via subprocess / pipe.
  - Returns structured JSON metrics (distance, estimated time, route sequence).

### `frontend/` (React + Vite + Tailwind CSS)
- **Role:** Interactive operator dashboard.
- **Responsibilities:**
  - Renders simulated city street grid and nodes using native SVG.
  - Visualizes delivery route sequence, vehicle progress, and comparative metrics.
  - Controls for selecting algorithms, depots, and delivery stops.

### `data/` (City & Delivery Datasets)
- Holds structured JSON data defining intersections, road segments, speed limits, and sample delivery packages.

### `docs/`
- Architecture diagrams, algorithm time/space complexity analysis, and verification test cases.
