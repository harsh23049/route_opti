#include "JsonInterface.h"
#include "Graph.h"
#include "Optimizer.h"
#include <iostream>
#include <chrono>
#include <cmath>

namespace DeliveryOptimizer {

namespace {

using SimpleJson::JsonValue;

// Leg-by-leg geometry for one tour, emitted under three keys per route variant.
struct RouteGeometry {
    JsonValue legs;
    JsonValue fullRoadPath;
    JsonValue fullCoordinates;
};

JsonValue coordinateOf(const Graph& graph, const std::string& nodeId) {
    JsonValue pair;
    const Node* node = graph.getNode(nodeId);
    pair.push_back(node ? node->lat : 0.0);
    pair.push_back(node ? node->lng : 0.0);
    return pair;
}

JsonValue toJsonArray(const std::vector<std::string>& items) {
    JsonValue arr(std::vector<JsonValue>{});
    for (const auto& item : items) arr.push_back(item);
    return arr;
}

RouteGeometry buildGeometry(const Graph& graph, const DistanceMatrix& matrix,
                            const std::vector<std::string>& tour) {
    RouteGeometry geo;
    geo.legs = JsonValue(std::vector<JsonValue>{});
    for (size_t i = 0; i + 1 < tour.size(); ++i) {
        const std::string& u = tour[i];
        const std::string& v = tour[i + 1];

        JsonValue leg;
        leg["from"] = u;
        leg["to"] = v;
        leg["distanceKm"] = matrix.getDistance(u, v);

        const std::vector<std::string> pathNodes = matrix.getRoadPath(u, v);
        JsonValue coords(std::vector<JsonValue>{});
        for (const auto& nodeId : pathNodes) coords.push_back(coordinateOf(graph, nodeId));
        leg["pathNodes"] = toJsonArray(pathNodes);
        leg["coordinates"] = coords;
        geo.legs.push_back(leg);
    }

    const std::vector<std::string> fullPath = RouteUtils::expandToFullRoadPath(tour, matrix);
    geo.fullRoadPath = toJsonArray(fullPath);
    geo.fullCoordinates = JsonValue(std::vector<JsonValue>{});
    for (const auto& nodeId : fullPath) geo.fullCoordinates.push_back(coordinateOf(graph, nodeId));
    return geo;
}

JsonValue fleetJson(const Graph& graph, const DistanceMatrix& matrix, const FleetPlan& plan) {
    JsonValue out;
    out["totalDistance"] = plan.totalDistanceKm;
    out["longestRoute"] = plan.longestRouteKm;
    JsonValue routes(std::vector<JsonValue>{});
    for (size_t i = 0; i < plan.routes.size(); ++i) {
        const std::vector<std::string> tour = matrix.toIds(plan.routes[i].tour);
        RouteGeometry geo = buildGeometry(graph, matrix, tour);
        JsonValue r;
        r["vehicle"] = static_cast<double>(i + 1);
        r["route"] = toJsonArray(tour);
        r["distance"] = plan.routes[i].distanceKm;
        r["legs"] = geo.legs;
        r["fullRoadPath"] = geo.fullRoadPath;
        r["fullCoordinates"] = geo.fullCoordinates;
        routes.push_back(r);
    }
    out["routes"] = routes;
    return out;
}

std::string fieldError(const std::string& what, size_t index, const std::string& problem) {
    return what + " at index " + std::to_string(index) + " " + problem;
}

} // namespace

std::string JsonInterface::errorJson(const std::string& message) {
    std::cerr << "[JsonInterface Error] " << message << "\n";
    JsonValue res;
    res["success"] = false;
    res["error"] = message;
    return res.serialize();
}

std::string JsonInterface::processJson(const std::string& inputJson, bool* ok) {
    auto startTime = std::chrono::high_resolution_clock::now();
    if (ok) *ok = false;

    std::string parseErr;
    JsonValue root = JsonValue::parse(inputJson, parseErr);

    if (!parseErr.empty() || !root.isObject()) {
        return errorJson("Malformed JSON input: " + (parseErr.empty() ? "Expected root JSON object" : parseErr));
    }

    // 1. Parse Nodes: [{ "id": string, "name"?: string, "lat"?: number, "lng"?: number }]
    if (!root["nodes"].isArray() || root["nodes"].asArray().empty()) {
        return errorJson("'nodes' must be a non-empty array");
    }

    Graph graph;
    const auto& nodesArr = root["nodes"].asArray();
    for (size_t i = 0; i < nodesArr.size(); ++i) {
        const auto& nVal = nodesArr[i];
        if (!nVal["id"].isString()) {
            return errorJson(fieldError("Node", i, "must have a string 'id'"));
        }
        const std::string& id = nVal["id"].asString();
        try {
            graph.addNode(id, nVal["name"].asString(), nVal["lat"].asDouble(), nVal["lng"].asDouble());
        } catch (const std::exception& ex) {
            return errorJson("Failed adding node '" + id + "': " + ex.what());
        }
    }

    // 2. Parse Roads: [{ "source": string, "target": string, "distance_km": number, "street_name"?: string }]
    if (!root["roads"].isArray()) {
        return errorJson("'roads' must be an array");
    }

    const auto& roadsArr = root["roads"].asArray();
    for (size_t i = 0; i < roadsArr.size(); ++i) {
        const auto& rVal = roadsArr[i];
        if (!rVal["source"].isString() || !rVal["target"].isString()) {
            return errorJson(fieldError("Road", i, "must have string 'source' and 'target'"));
        }
        // A missing distance must not silently become a free 0 km road.
        if (!rVal["distance_km"].isNumber()) {
            return errorJson(fieldError("Road", i, "must have a numeric 'distance_km'"));
        }

        const std::string& src = rVal["source"].asString();
        const std::string& tgt = rVal["target"].asString();
        try {
            graph.addEdge(src, tgt, rVal["distance_km"].asDouble(), rVal["street_name"].asString());
        } catch (const std::exception& ex) {
            return errorJson("Invalid road between '" + src + "' and '" + tgt + "': " + ex.what());
        }
    }

    // 3. Warehouse node ID
    if (!root["warehouse"].isString() || root["warehouse"].asString().empty()) {
        return errorJson("'warehouse' must be a non-empty node ID string");
    }
    const std::string& warehouseId = root["warehouse"].asString();

    // 4. Delivery stops: [string]
    if (!root["stops"].isArray()) {
        return errorJson("'stops' must be an array of node ID strings");
    }
    std::vector<std::string> stops;
    const auto& stopsArr = root["stops"].asArray();
    for (size_t i = 0; i < stopsArr.size(); ++i) {
        if (!stopsArr[i].isString()) {
            return errorJson(fieldError("Stop", i, "must be a node ID string"));
        }
        stops.push_back(stopsArr[i].asString());
    }

    // 5. Vehicles: optional integer in [1, Fleet::kMaxVehicles], default 1
    int vehicles = 1;
    if (!root["vehicles"].isNull()) {
        const double count = root["vehicles"].asDouble(0.0);
        if (!root["vehicles"].isNumber() || count != std::floor(count) || count < 1 || count > Fleet::kMaxVehicles) {
            return errorJson("'vehicles' must be an integer from 1 to " + std::to_string(Fleet::kMaxVehicles));
        }
        vehicles = static_cast<int>(count);
    }

    // 6. Run Core Optimization Pipeline
    OptimizationPipelineResult pipeline = Optimizer::runPipeline(graph, warehouseId, stops, vehicles);
    if (!pipeline.success) {
        return errorJson(pipeline.errorMessage);
    }

    const DistanceMatrix& matrix = pipeline.matrix;
    const TourResult& initial = pipeline.nearestNeighborTour;
    const TourResult& optimized = pipeline.optimizedTour;
    const TourResult& exact = pipeline.exactTour;

    // 7. Assemble Output JSON
    JsonValue response;
    response["success"] = true;

    double saved = initial.totalDistanceKm - optimized.totalDistanceKm;
    if (saved < 0.0) saved = 0.0;
    response["initialRoute"] = toJsonArray(initial.tour);
    response["optimizedRoute"] = toJsonArray(optimized.tour);
    response["initialDistance"] = initial.totalDistanceKm;
    response["optimizedDistance"] = optimized.totalDistanceKm;
    response["distanceSaved"] = saved;
    response["improvementPercent"] =
        initial.totalDistanceKm > 0.0 ? saved / initial.totalDistanceKm * 100.0 : 0.0;

    JsonValue stages(std::vector<JsonValue>{});
    auto addStage = [&stages](const std::string& name, double distanceKm) {
        JsonValue stage;
        stage["algorithm"] = name;
        stage["distanceKm"] = distanceKm;
        stages.push_back(stage);
    };
    addStage("Nearest Neighbor", initial.totalDistanceKm);
    addStage("2-Opt", pipeline.twoOptTour.optimizedDistanceKm);
    addStage("Or-opt", optimized.totalDistanceKm);
    response["stages"] = stages;

    RouteGeometry optimizedGeo = buildGeometry(graph, matrix, optimized.tour);
    response["legs"] = optimizedGeo.legs;
    response["fullRoadPath"] = optimizedGeo.fullRoadPath;
    response["fullCoordinates"] = optimizedGeo.fullCoordinates;

    RouteGeometry initialGeo = buildGeometry(graph, matrix, initial.tour);
    response["initialLegs"] = initialGeo.legs;
    response["initialFullRoadPath"] = initialGeo.fullRoadPath;
    response["initialFullCoordinates"] = initialGeo.fullCoordinates;

    // Exact optimum (null when the instance is too large for Held-Karp)
    if (exact.success) {
        const double optimal = exact.totalDistanceKm;
        // Equal tours summed in a different order differ by ~1e-15; report those as 0.
        const double excess = optimized.totalDistanceKm - optimal;
        RouteGeometry optimalGeo = buildGeometry(graph, matrix, exact.tour);
        response["optimalRoute"] = toJsonArray(exact.tour);
        response["optimalDistance"] = optimal;
        response["optimalityGapPercent"] = (optimal > 0.0 && excess > 1e-9) ? excess / optimal * 100.0 : 0.0;
        response["optimalLegs"] = optimalGeo.legs;
        response["optimalFullRoadPath"] = optimalGeo.fullRoadPath;
        response["optimalFullCoordinates"] = optimalGeo.fullCoordinates;
    } else {
        for (const char* key : {"optimalRoute", "optimalDistance", "optimalityGapPercent",
                                "optimalLegs", "optimalFullRoadPath", "optimalFullCoordinates"}) {
            response[key] = JsonValue();
        }
    }

    // Multi-vehicle plan vs the equal-chunks baseline (null for a single van)
    response["vehicles"] = static_cast<double>(vehicles);
    if (vehicles > 1) {
        const FleetPlan& base = pipeline.fleetBaseline;
        const FleetPlan& best = pipeline.fleetOptimized;
        JsonValue fleet;
        fleet["baseline"] = fleetJson(graph, matrix, base);
        fleet["optimized"] = fleetJson(graph, matrix, best);
        const double longestSaved = std::max(0.0, base.longestRouteKm - best.longestRouteKm);
        fleet["longestRouteSaved"] = longestSaved;
        fleet["improvementPercent"] = base.longestRouteKm > 0.0 ? longestSaved / base.longestRouteKm * 100.0 : 0.0;
        response["fleet"] = fleet;
    } else {
        response["fleet"] = JsonValue();
    }

    auto endTime = std::chrono::high_resolution_clock::now();
    const double totalExecutionTimeMs =
        std::chrono::duration<double, std::milli>(endTime - startTime).count();
    response["executionTimeMs"] = totalExecutionTimeMs;

    // Diagnostics / Summary to stderr
    std::cerr << "[JsonInterface] Processed route successfully: "
              << initial.totalDistanceKm << " km -> "
              << optimized.totalDistanceKm << " km in "
              << totalExecutionTimeMs << " ms\n";

    if (ok) *ok = true;
    return response.serialize(2);
}

} // namespace DeliveryOptimizer
