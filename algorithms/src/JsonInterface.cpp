#include "JsonInterface.h"
#include "Graph.h"
#include "Optimizer.h"
#include <iostream>
#include <chrono>

namespace DeliveryOptimizer {

namespace {

SimpleJson::JsonValue makeErrorResponse(const std::string& errorMsg) {
    std::cerr << "[JsonInterface Error] " << errorMsg << "\n";
    SimpleJson::JsonValue res;
    res["success"] = false;
    res["error"] = errorMsg;
    return res;
}

} // namespace

std::string JsonInterface::processJson(const std::string& inputJson) {
    auto startTime = std::chrono::high_resolution_clock::now();

    std::string parseErr;
    SimpleJson::JsonValue root = SimpleJson::JsonValue::parse(inputJson, parseErr);

    if (!parseErr.empty() || !root.isObject()) {
        return makeErrorResponse("Malformed JSON input: " + (parseErr.empty() ? "Expected root JSON object" : parseErr)).serialize();
    }

    // 1. Parse Nodes
    if (!root.has("nodes") || !root["nodes"].isArray()) {
        return makeErrorResponse("Missing or invalid 'nodes' array in JSON input").serialize();
    }

    Graph graph;
    std::map<std::string, std::pair<double, double>> nodeCoords;

    const auto& nodesArr = root["nodes"].asArray();
    if (nodesArr.empty()) {
        return makeErrorResponse("Input 'nodes' array cannot be empty").serialize();
    }

    for (size_t i = 0; i < nodesArr.size(); ++i) {
        const auto& nVal = nodesArr[i];
        if (!nVal.isObject() || !nVal.has("id")) {
            return makeErrorResponse("Node at index " + std::to_string(i) + " is missing required 'id' field").serialize();
        }
        std::string id = nVal["id"].asString();
        std::string name = nVal.has("name") ? nVal["name"].asString() : id;
        double lat = nVal.has("lat") ? nVal["lat"].asDouble() : 0.0;
        double lng = nVal.has("lng") ? nVal["lng"].asDouble() : 0.0;

        try {
            graph.addNode(id, name, lat, lng);
            nodeCoords[id] = {lat, lng};
        } catch (const std::exception& ex) {
            return makeErrorResponse(std::string("Failed adding node '") + id + "': " + ex.what()).serialize();
        }
    }

    // 2. Parse Roads / Edges
    if (!root.has("roads") || !root["roads"].isArray()) {
        return makeErrorResponse("Missing or invalid 'roads' array in JSON input").serialize();
    }

    const auto& roadsArr = root["roads"].asArray();
    for (size_t i = 0; i < roadsArr.size(); ++i) {
        const auto& rVal = roadsArr[i];
        if (!rVal.isObject() || !rVal.has("source") || !rVal.has("target")) {
            return makeErrorResponse("Road at index " + std::to_string(i) + " is missing 'source' or 'target'").serialize();
        }

        std::string src = rVal["source"].asString();
        std::string tgt = rVal["target"].asString();
        double dist = 0.0;
        if (rVal.has("distance_km")) {
            dist = rVal["distance_km"].asDouble();
        } else if (rVal.has("distance")) {
            dist = rVal["distance"].asDouble();
        } else if (rVal.has("weight")) {
            dist = rVal["weight"].asDouble();
        }

        std::string streetName = rVal.has("street_name") ? rVal["street_name"].asString() : "";

        try {
            graph.addEdge(src, tgt, dist, streetName);
        } catch (const std::exception& ex) {
            return makeErrorResponse(std::string("Invalid road between '") + src + "' and '" + tgt + "': " + ex.what()).serialize();
        }
    }

    // 3. Extract Warehouse Node ID
    std::string warehouseId;
    if (root.has("warehouse") && root["warehouse"].isString()) {
        warehouseId = root["warehouse"].asString();
    } else if (root.has("warehouseId") && root["warehouseId"].isString()) {
        warehouseId = root["warehouseId"].asString();
    } else if (root.has("depot")) {
        if (root["depot"].isString()) {
            warehouseId = root["depot"].asString();
        } else if (root["depot"].isObject() && root["depot"].has("id")) {
            warehouseId = root["depot"]["id"].asString();
        }
    }

    if (warehouseId.empty()) {
        return makeErrorResponse("Missing required 'warehouse' or 'warehouseId' or 'depot' in input JSON").serialize();
    }

    if (!graph.hasNode(warehouseId)) {
        return makeErrorResponse("Specified warehouse '" + warehouseId + "' does not exist in graph nodes").serialize();
    }

    // 4. Extract Required Delivery Stops
    std::vector<std::string> stops;
    if (root.has("stops") && root["stops"].isArray()) {
        for (const auto& item : root["stops"].asArray()) {
            if (item.isString()) stops.push_back(item.asString());
            else if (item.isObject() && item.has("id")) stops.push_back(item["id"].asString());
            else if (item.isObject() && item.has("nodeId")) stops.push_back(item["nodeId"].asString());
        }
    } else if (root.has("deliveryStops") && root["deliveryStops"].isArray()) {
        for (const auto& item : root["deliveryStops"].asArray()) {
            if (item.isString()) stops.push_back(item.asString());
            else if (item.isObject() && item.has("nodeId")) stops.push_back(item["nodeId"].asString());
            else if (item.isObject() && item.has("id")) stops.push_back(item["id"].asString());
        }
    } else if (root.has("sampleDeliveryStops") && root["sampleDeliveryStops"].isArray()) {
        for (const auto& item : root["sampleDeliveryStops"].asArray()) {
            if (item.isString()) stops.push_back(item.asString());
            else if (item.isObject() && item.has("nodeId")) stops.push_back(item["nodeId"].asString());
            else if (item.isObject() && item.has("id")) stops.push_back(item["id"].asString());
        }
    }

    // 5. Run Core Optimization Pipeline
    OptimizationPipelineResult pipeline = Optimizer::runPipeline(graph, warehouseId, stops);
    if (!pipeline.success) {
        return makeErrorResponse(pipeline.errorMessage).serialize();
    }

    auto endTime = std::chrono::high_resolution_clock::now();
    double totalExecutionTimeMs =
        std::chrono::duration<double, std::milli>(endTime - startTime).count();

    // 6. Assemble Valid Output JSON
    SimpleJson::JsonValue response;
    response["success"] = true;

    // Required schema fields:
    // initialRoute, optimizedRoute, initialDistance, optimizedDistance,
    // distanceSaved, improvementPercent, and executionTimeMs
    SimpleJson::JsonValue initRouteArr;
    for (const auto& stop : pipeline.nearestNeighborTour.tour) {
        initRouteArr.push_back(stop);
    }
    response["initialRoute"] = initRouteArr;

    SimpleJson::JsonValue optRouteArr;
    for (const auto& stop : pipeline.twoOptTour.optimizedTour) {
        optRouteArr.push_back(stop);
    }
    response["optimizedRoute"] = optRouteArr;

    response["initialDistance"] = pipeline.twoOptTour.initialDistanceKm;
    response["optimizedDistance"] = pipeline.twoOptTour.optimizedDistanceKm;
    response["distanceSaved"] = pipeline.twoOptTour.distanceSavedKm;
    response["improvementPercent"] = pipeline.twoOptTour.percentageImprovement;
    response["executionTimeMs"] = totalExecutionTimeMs;

    // Helper lambda to construct leg geometries and full coordinate sequences
    auto buildLegsAndCoords = [&](const std::vector<std::string>& tour,
                                  const std::vector<std::string>& fullRoadPath,
                                  SimpleJson::JsonValue& outLegs,
                                  SimpleJson::JsonValue& outFullPath,
                                  SimpleJson::JsonValue& outFullCoords) {
        for (size_t i = 0; i < tour.size() - 1; ++i) {
            const std::string& u = tour[i];
            const std::string& v = tour[i + 1];

            SimpleJson::JsonValue legObj;
            legObj["from"] = u;
            legObj["to"] = v;
            legObj["distanceKm"] = pipeline.matrix.getDistance(u, v);

            const auto& pathNodes = pipeline.matrix.getRoadPath(u, v);
            SimpleJson::JsonValue nodesArrVal;
            SimpleJson::JsonValue coordsArrVal;

            for (const auto& nodeId : pathNodes) {
                nodesArrVal.push_back(nodeId);
                auto it = nodeCoords.find(nodeId);
                if (it != nodeCoords.end()) {
                    SimpleJson::JsonValue coordPair;
                    coordPair.push_back(it->second.first);  // lat
                    coordPair.push_back(it->second.second); // lng
                    coordsArrVal.push_back(coordPair);
                }
            }
            legObj["pathNodes"] = nodesArrVal;
            legObj["coordinates"] = coordsArrVal;

            outLegs.push_back(legObj);
        }

        for (const auto& nodeId : fullRoadPath) {
            outFullPath.push_back(nodeId);
            auto it = nodeCoords.find(nodeId);
            if (it != nodeCoords.end()) {
                SimpleJson::JsonValue coordPair;
                coordPair.push_back(it->second.first);  // lat
                coordPair.push_back(it->second.second); // lng
                outFullCoords.push_back(coordPair);
            }
        }
    };

    // 2-Opt Optimized Route Geometries (primary)
    SimpleJson::JsonValue legsArr;
    SimpleJson::JsonValue fullPathArr;
    SimpleJson::JsonValue fullCoordsArr;
    buildLegsAndCoords(pipeline.twoOptTour.optimizedTour,
                       pipeline.optimizedFullRoadPath,
                       legsArr, fullPathArr, fullCoordsArr);

    response["legs"] = legsArr;
    response["fullRoadPath"] = fullPathArr;
    response["fullCoordinates"] = fullCoordsArr;

    // Nearest Neighbor Initial Route Geometries (for comparative map visualization)
    SimpleJson::JsonValue initLegsArr;
    SimpleJson::JsonValue initFullPathArr;
    SimpleJson::JsonValue initFullCoordsArr;
    buildLegsAndCoords(pipeline.nearestNeighborTour.tour,
                       pipeline.initialFullRoadPath,
                       initLegsArr, initFullPathArr, initFullCoordsArr);

    response["initialLegs"] = initLegsArr;
    response["initialFullRoadPath"] = initFullPathArr;
    response["initialFullCoordinates"] = initFullCoordsArr;

    // Diagnostics / Summary to stderr
    std::cerr << "[JsonInterface] Processed route successfully: "
              << pipeline.twoOptTour.initialDistanceKm << " km -> "
              << pipeline.twoOptTour.optimizedDistanceKm << " km (-"
              << pipeline.twoOptTour.percentageImprovement << "%) in "
              << totalExecutionTimeMs << " ms\n";

    return response.serialize(2);
}

} // namespace DeliveryOptimizer
