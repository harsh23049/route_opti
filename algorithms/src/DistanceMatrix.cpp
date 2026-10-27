#include "DistanceMatrix.h"
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
    outMatrix.roadPaths_.assign(m, std::vector<std::vector<std::string>>(m));

    // 4. Compute Dijkstra shortest paths from each location
    for (size_t i = 0; i < m; ++i) {
        const std::string& fromId = outMatrix.locationIds_[i];
        int fromGraphIdx = graph.getNodeIndex(fromId);
        SingleSourceResult ssr = Dijkstra::computeFromSource(graph, fromGraphIdx);

        for (size_t j = 0; j < m; ++j) {
            if (i == j) {
                outMatrix.distances_[i][j] = 0.0;
                outMatrix.roadPaths_[i][j] = {fromId};
            } else {
                const std::string& toId = outMatrix.locationIds_[j];
                int toGraphIdx = graph.getNodeIndex(toId);

                // Requirement (7): Handle unreachable locations
                if (!ssr.isReachable(toGraphIdx)) {
                    errorMessage = "Unreachable location detected: no road path exists between '" +
                                   fromId + "' and '" + toId + "'";
                    return false;
                }

                outMatrix.distances_[i][j] = ssr.distances[toGraphIdx];
                outMatrix.roadPaths_[i][j] = ssr.reconstructPathNodes(graph, toGraphIdx);
            }
        }
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

const std::vector<std::string>& DistanceMatrix::getRoadPath(int i, int j) const {
    static const std::vector<std::string> emptyPath;
    if (i >= 0 && i < static_cast<int>(roadPaths_.size()) &&
        j >= 0 && j < static_cast<int>(roadPaths_[i].size())) {
        return roadPaths_[i][j];
    }
    return emptyPath;
}

const std::vector<std::string>& DistanceMatrix::getRoadPath(const std::string& u, const std::string& v) const {
    static const std::vector<std::string> emptyPath;
    int i = getIndex(u);
    int j = getIndex(v);
    if (i == -1 || j == -1) {
        return emptyPath;
    }
    return getRoadPath(i, j);
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
