# C++ Algorithm Engine — JSON Input/Output Interface

The C++ optimization engine (`optimizer_engine`) reads one JSON request and writes one JSON response. The backend uses this interface over stdin/stdout. The HTTP API (`POST /api/optimize`) accepts the same request schema and returns the same response.

---

## 1. Execution Modes

```bash
optimizer_engine < payload.json          # stdin (the backend's IPC path)
optimizer_engine --file payload.json     # read from a file
optimizer_engine --demo                  # built-in demonstration
optimizer_engine --version               # print the engine version
optimizer_engine --help                  # usage
```

On Windows the binary is `optimizer_engine.exe`. `npm run build:cpp` places it in `algorithms/build/` on every platform.

**Stream separation:** `stdout` carries exactly one JSON document. Diagnostics and timing go to `stderr`.

**Exit codes:**

| Code | Meaning |
|---|---|
| `0` | Success (`"success": true`) |
| `1` | Request rejected or not solvable (`"success": false`, JSON still printed on stdout) |
| `2` | Bad command-line arguments (usage printed on stderr) |

---

## 2. Request Schema

The schema is strict. Unknown aliases (`warehouseId`, `depot`, `deliveryStops`, `distanceKm`, `weight`, ...) are rejected, and a missing distance is never treated as 0 km.

```json
{
  "warehouse": "W",
  "stops": ["S1", "S2"],
  "nodes": [
    { "id": "W",  "name": "Central Depot", "lat": 37.7830, "lng": -122.4080 },
    { "id": "S1", "name": "Market Drop",   "lat": 37.7915, "lng": -122.3990 },
    { "id": "S2", "lat": 37.7940, "lng": -122.4020 }
  ],
  "roads": [
    { "source": "W",  "target": "S1", "distance_km": 1.5, "street_name": "Main St" },
    { "source": "S1", "target": "S2", "distance_km": 0.4 },
    { "source": "S2", "target": "W",  "distance_km": 1.8 }
  ],
  "vehicles": 1
}
```

| Field | Type | Rules |
|---|---|---|
| `warehouse` | string | Must be a node ID |
| `stops` | string[] | Node IDs. Duplicates and the warehouse itself are ignored |
| `nodes[].id` | string | Unique, non-empty |
| `nodes[].name` | string, optional | Defaults to the ID |
| `nodes[].lat`, `lng` | number, optional | Default `0`. The API also enforces `[-90, 90]` / `[-180, 180]` |
| `roads[].source`, `target` | string | Existing node IDs. Roads are undirected |
| `roads[].distance_km` | number | Finite and `>= 0` |
| `roads[].street_name` | string, optional | |
| `vehicles` | integer, optional | `1` to `10`, default `1`. More than one adds the `fleet` block to the response |

**API limits** (configurable, see the README): 5000 nodes, 20000 roads, 100 stops, 2 MB body.

---

## 3. Success Response

Response for `data/sample-input.json` (shortened; the full file is `data/sample-output.json`):

```json
{
  "success": true,
  "initialRoute":   ["node_0", "node_1", "node_2", "node_3", "node_4", "node_0"],
  "optimizedRoute": ["node_0", "node_2", "node_1", "node_3", "node_4", "node_0"],
  "optimalRoute":   ["node_0", "node_4", "node_3", "node_1", "node_2", "node_0"],
  "initialDistance": 5.45,
  "optimizedDistance": 5.1,
  "optimalDistance": 5.1,
  "distanceSaved": 0.35,
  "improvementPercent": 6.42201834862,
  "optimalityGapPercent": 0,
  "executionTimeMs": 0.28,
  "stages": [
    { "algorithm": "Nearest Neighbor", "distanceKm": 5.45 },
    { "algorithm": "2-Opt", "distanceKm": 5.1 },
    { "algorithm": "Or-opt", "distanceKm": 5.1 }
  ],
  "legs": [
    {
      "from": "node_0",
      "to": "node_2",
      "distanceKm": 1.55,
      "pathNodes": ["node_0", "j_1", "node_2"],
      "coordinates": [[37.783, -122.408], [37.788, -122.403], [37.794, -122.402]]
    }
  ],
  "fullRoadPath": ["node_0", "j_1", "node_2", "node_1", "node_3", "node_4", "j_3", "j_2", "node_0"],
  "fullCoordinates": [[37.783, -122.408], [37.788, -122.403]],
  "initialLegs": [],
  "initialFullRoadPath": [],
  "initialFullCoordinates": [],
  "optimalLegs": [],
  "optimalFullRoadPath": [],
  "optimalFullCoordinates": []
}
```

| Field | Meaning |
|---|---|
| `initialRoute`, `initialDistance` | Nearest Neighbor tour |
| `optimizedRoute`, `optimizedDistance` | Final heuristic tour: NN, then 2-Opt, then alternating Or-opt / 2-Opt |
| `distanceSaved`, `improvementPercent` | Final tour compared with NN |
| `stages` | Tour length after each stage |
| `optimalRoute`, `optimalDistance`, `optimalityGapPercent` | Held-Karp exact optimum and the heuristic's gap to it. **`null` when there are more than 15 stops** |
| `legs` / `initialLegs` / `optimalLegs` | Per-leg road geometry for each route variant (`optimalLegs` is `null` above 15 stops) |
| `fullRoadPath`, `fullCoordinates` (and `initial*`, `optimal*`) | The whole route as road nodes and `[lat, lng]` pairs |
| `executionTimeMs` | Engine time, including JSON parsing |
| `vehicles` | Number of vans requested |
| `fleet` | Multi-van plan, or `null` for one van (see below) |

### Multi-van plan (`vehicles` > 1)

```json
"fleet": {
  "baseline":  { "totalDistance": 19.28, "longestRoute": 7.90, "routes": [] },
  "optimized": {
    "totalDistance": 15.36,
    "longestRoute": 5.22,
    "routes": [
      { "vehicle": 1, "route": ["W", "S12", "S2", "W"], "distance": 5.14,
        "legs": [], "fullRoadPath": [], "fullCoordinates": [] }
    ]
  },
  "longestRouteSaved": 2.68,
  "improvementPercent": 33.96
}
```

| Field | Meaning |
|---|---|
| `baseline` | The Nearest Neighbor tour cut into equal consecutive parts, one per van, not re-optimized |
| `optimized` | Route-first cluster-second split with balancing (see the algorithm design). Vans that would get no stop are left out, so `routes` can be shorter than `vehicles` |
| `routes[]` | One closed depot-to-depot route per van, with the same leg and geometry fields as the single-van routes |
| `longestRoute`, `totalDistance` | The longest van route (when all deliveries are done) and the sum over all vans |
| `longestRouteSaved`, `improvementPercent` | Optimized longest route compared with the baseline's |

---

## 4. Error Response

```json
{
  "success": false,
  "error": "Distance matrix build failed: Unreachable location detected: no road path exists between 'W' and 'ISLAND'"
}
```

The HTTP API wraps errors as `{ "success": false, "error": "...", "code": "..." }`:

| Status | `code` | Cause |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Request failed schema or limit checks |
| 400 | `ALGORITHM_ERROR` | Engine rejected the input (for example an unreachable stop) |
| 400 | `JSON_SYNTAX_ERROR` | Body is not valid JSON |
| 413 | `PAYLOAD_TOO_LARGE` | Body larger than `MAX_BODY_SIZE` |
| 503 | `ENGINE_BUSY` | All engine slots and the wait queue are full; retry |
| 504 | `PROCESS_TIMEOUT` | Engine exceeded `EXECUTION_TIMEOUT_MS` |
| 500 | `EXECUTABLE_NOT_FOUND`, `ENGINE_START_FAILED`, `MALFORMED_ENGINE_OUTPUT`, `INTERNAL_ERROR` | Server-side problem (details only in server logs) |
