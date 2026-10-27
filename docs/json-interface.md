# C++ Algorithm Engine — JSON Input/Output Interface

The C++ optimization engine (`optimizer_engine`) provides a standard JSON input/output interface designed for seamless IPC (Inter-Process Communication) with the Node.js backend.

---

## 1. Execution Modes

### Standard Input / Pipe (Recommended for IPC)
```bash
cat payload.json | ./algorithms/build/optimizer_engine
```

### File Argument
```bash
./algorithms/build/optimizer_engine --file /path/to/payload.json
```

### Terminal Demonstration Mode
```bash
./algorithms/build/optimizer_engine --demo
```

> **Stream Separation Guarantee:**
> - **Standard Output (`stdout`)**: Receives strictly valid, parseable JSON and nothing else.
> - **Standard Error (`stderr`)**: Receives diagnostic logs, timing traces, and internal warning messages.

---

## 2. Input JSON Schema

The engine accepts a complete road network graph, a designated warehouse/depot, and required delivery stop IDs:

```json
{
  "warehouse": "string (node ID of warehouse / starting hub)",
  "stops": [
    "string (node ID of required delivery stop 1)",
    "string (node ID of required delivery stop 2)"
  ],
  "nodes": [
    {
      "id": "string (unique node ID)",
      "name": "string (optional human-readable name)",
      "lat": "number (latitude in degrees)",
      "lng": "number (longitude in degrees)"
    }
  ],
  "roads": [
    {
      "source": "string (node ID)",
      "target": "string (node ID)",
      "distance_km": "number (non-negative road distance in km)",
      "street_name": "string (optional street name)"
    }
  ]
}
```

*Note: For compatibility, the engine also accepts `"warehouseId"` or `"depot"` (`"id"`), and `"deliveryStops"` or `"sampleDeliveryStops"`.*

---

## 3. Success Response Schema

When optimization succeeds, the engine outputs:

```json
{
  "success": true,
  "initialRoute": [
    "node_0",
    "node_5",
    "node_4",
    "node_3",
    "node_1",
    "node_2",
    "node_0"
  ],
  "optimizedRoute": [
    "node_0",
    "node_5",
    "node_4",
    "node_3",
    "node_1",
    "node_2",
    "node_0"
  ],
  "initialDistance": 6.9,
  "optimizedDistance": 6.9,
  "distanceSaved": 0.0,
  "improvementPercent": 0.0,
  "executionTimeMs": 0.185,
  "legs": [
    {
      "from": "node_0",
      "to": "node_5",
      "distanceKm": 1.2,
      "pathNodes": ["node_0", "node_5"],
      "coordinates": [
        [37.7830, -122.4080],
        [37.7795, -122.4185]
      ]
    }
  ],
  "fullRoadPath": [
    "node_0",
    "node_5",
    "j_2",
    "j_3",
    "node_4",
    "node_3",
    "node_1",
    "node_2",
    "j_1",
    "node_0"
  ],
  "fullCoordinates": [
    [37.7830, -122.4080],
    [37.7795, -122.4185],
    [37.7845, -122.4040],
    [37.7818, -122.4010],
    [37.7820, -122.3940],
    [37.7875, -122.3910],
    [37.7915, -122.3990],
    [37.7940, -122.4020],
    [37.7880, -122.4030],
    [37.7830, -122.4080]
  ]
}
```

---

## 4. Error Response Schema

For malformed JSON, missing parameters, invalid node IDs, or unreachable vertices:

```json
{
  "success": false,
  "error": "Unreachable location detected: no road path exists between 'node_0' and 'node_island'"
}
```
Diagnostic details explaining the exact parser position or missing identifier are also printed directly to `stderr`.
