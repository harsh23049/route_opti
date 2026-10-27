#include "DistanceMatrix.h"
#include <algorithm>
#include <chrono>
#include <cmath>
#include <unordered_set>

namespace DeliveryOptimizer {

bool DistanceMatrix::build(const Graph& graph,
                           const std::string& warehouseId,
                           const std::vector<std::string>& stopIds,
                           DistanceMatrix& outMatrix,
                           std::string& errorMessage) {
    auto startTime = std::chrono::high_resolution_clock::now();
    errorMessage.clear();

    outMatrix = DistanceMatrix();

    // 1. Validate warehouse existence
    if (!graph.hasNode(warehouseId)) {
        errorMessage = "Warehouse node does not exist in graph: '" + warehouseId + "'";
        return false;
    }

    // 2. Validate and deduplicate stop IDs
    std::unordered_set<std::string> seenStops;
    std::vector<std::string> cleanStops;

    for (const auto& stopId : stopIds) {
        if (stopId.empty()) {
            errorMessage = "Encountered empty stop ID in delivery stop list";
            return false;
        }
        if (!graph.hasNode(stopId)) {
            errorMessage = "Delivery stop node does not exist in graph: '" + stopId + "'";
            return false;
        }
        // Do not add warehouse as an intermediate stop if passed in stopIds
        if (stopId != warehouseId && seenStops.find(stopId) == seenStops.end()) {
            seenStops.insert(stopId);
            cleanStops.push_back(stopId);
        }
    }

    // 3. Assemble complete list of locations: warehouse is index 0
    outMatrix.warehouseId_ = warehouseId;
    outMatrix.locationIds_.push_back(warehouseId);
    outMatrix.idToIndex_[warehouseId] = 0;

    for (const auto& stopId : cleanStops) {
        int idx = static_cast<int>(outMatrix.locationIds_.size());
        outMatrix.locationIds_.push_back(stopId);
        outMatrix.idToIndex_[stopId] = idx;
    }

    size_t m = outMatrix.locationIds_.size();
    outMatrix.distances_.assign(m, std::vector<double>(m, 0.0));
    outMatrix.parents_.resize(m);
    outMatrix.graphIndex_.resize(m);
    for (size_t i = 0; i < m; ++i) {
        outMatrix.graphIndex_[i] = graph.getNodeIndex(outMatrix.locationIds_[i]);
    }
    outMatrix.nodeIds_.reserve(graph.getNodeCount());
    for (const Node& node : graph.getAllNodes()) {
        outMatrix.nodeIds_.push_back(node.id);
    }

    // 4. Compute Dijkstra shortest paths from each location
    for (size_t i = 0; i < m; ++i) {
        SingleSourceResult ssr = Dijkstra::computeFromSource(graph, outMatrix.graphIndex_[i]);

        for (size_t j = 0; j < m; ++j) {
            if (i == j) continue;
            int toGraphIdx = outMatrix.graphIndex_[j];

            // Requirement (7): Handle unreachable locations
            if (!ssr.isReachable(toGraphIdx)) {
                errorMessage = "Unreachable location detected: no road path exists between '" +
                               outMatrix.locationIds_[i] + "' and '" + outMatrix.locationIds_[j] + "'";
                return false;
            }
            outMatrix.distances_[i][j] = ssr.distances[toGraphIdx];
        }
        outMatrix.parents_[i] = std::move(ssr.parents);
    }

    outMatrix.valid_ = true;
    auto endTime = std::chrono::high_resolution_clock::now();
    outMatrix.buildTimeMicroseconds_ =
        std::chrono::duration<double, std::micro>(endTime - startTime).count();

    return true;
}

const std::string& DistanceMatrix::getWarehouseId() const {
    return warehouseId_;
}

int DistanceMatrix::getIndex(const std::string& id) const {
    auto it = idToIndex_.find(id);
    if (it != idToIndex_.end()) {
        return it->second;
    }
    return -1;
}

std::vector<std::string> DistanceMatrix::toIds(const std::vector<int>& indices) const {
    std::vector<std::string> ids;
    ids.reserve(indices.size());
    for (int idx : indices) {
        ids.push_back(locationIds_[idx]);
    }
    return ids;
}

bool DistanceMatrix::hasLocation(const std::string& id) const {
    return idToIndex_.find(id) != idToIndex_.end();
}

double DistanceMatrix::getDistance(int i, int j) const {
    if (i >= 0 && i < static_cast<int>(distances_.size()) &&
        j >= 0 && j < static_cast<int>(distances_[i].size())) {
        return distances_[i][j];
    }
    return std::numeric_limits<double>::infinity();
}

double DistanceMatrix::getDistance(const std::string& u, const std::string& v) const {
    int i = getIndex(u);
    int j = getIndex(v);
    if (i == -1 || j == -1) {
        return std::numeric_limits<double>::infinity();
    }
    return getDistance(i, j);
}

std::vector<std::string> DistanceMatrix::getRoadPath(int i, int j) const {
    std::vector<std::string> path;
    const int m = static_cast<int>(parents_.size());
    if (i < 0 || i >= m || j < 0 || j >= m) {
        return path;
    }

    const std::vector<int>& parents = parents_[i];
    const int source = graphIndex_[i];
    for (int curr = graphIndex_[j]; curr != -1; curr = parents[curr]) {
        path.push_back(nodeIds_[curr]);
        if (curr == source) break;
    }
    std::reverse(path.begin(), path.end());
    return path;
}

std::vector<std::string> DistanceMatrix::getRoadPath(const std::string& u, const std::string& v) const {
    return getRoadPath(getIndex(u), getIndex(v));
}

bool DistanceMatrix::isSymmetric(double tolerance) const {
    if (!valid_ || distances_.empty()) return false;
    size_t m = distances_.size();
    for (size_t i = 0; i < m; ++i) {
        for (size_t j = i + 1; j < m; ++j) {
            if (std::abs(distances_[i][j] - distances_[j][i]) > tolerance) {
                return false;
            }
        }
    }
    return true;
}

} // namespace DeliveryOptimizer
