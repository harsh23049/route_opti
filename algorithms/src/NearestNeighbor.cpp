#include "NearestNeighbor.h"
#include <chrono>
#include <limits>

namespace DeliveryOptimizer {

TourResult NearestNeighbor::solve(const DistanceMatrix& matrix) {
    auto startTime = std::chrono::high_resolution_clock::now();

    TourResult result;
    result.algorithm = "Nearest Neighbor";

    if (!matrix.isValid()) {
        result.success = false;
        result.errorMessage = "Cannot run Nearest Neighbor: Distance matrix is invalid";
        return result;
    }

    size_t m = matrix.size();
    if (m == 0) {
        result.success = false;
        result.errorMessage = "Distance matrix is empty";
        return result;
    }

    const std::string& warehouseId = matrix.getWarehouseId();

    // Edge case: Only warehouse, 0 delivery stops
    if (m == 1) {
        result.success = true;
        result.tour = {warehouseId, warehouseId};
        result.tourIndices = {0, 0};
        result.totalDistanceKm = 0.0;
        auto endTime = std::chrono::high_resolution_clock::now();
        result.executionTimeMicroseconds =
            std::chrono::duration<double, std::micro>(endTime - startTime).count();
        return result;
    }

    std::vector<bool> visited(m, false);
    std::vector<int> tourIndices;
    tourIndices.reserve(m + 1);

    // Start at warehouse (index 0)
    int current = 0;
    visited[0] = true;
    tourIndices.push_back(0);

    double totalDistance = 0.0;
    size_t visitedCount = 1;

    // Greedily select the nearest unvisited stop
    while (visitedCount < m) {
        int nearestIdx = -1;
        double minDistance = std::numeric_limits<double>::infinity();

        for (size_t next = 1; next < m; ++next) {
            if (!visited[next]) {
                double d = matrix.getDistance(current, static_cast<int>(next));
                if (d < minDistance) {
                    minDistance = d;
                    nearestIdx = static_cast<int>(next);
                }
            }
        }

        // If no reachable unvisited stop is found
        if (nearestIdx == -1 || minDistance >= (std::numeric_limits<double>::infinity() / 2.0)) {
            result.success = false;
            result.errorMessage = "No reachable remaining delivery stops from location index " +
                                  std::to_string(current);
            return result;
        }

        visited[nearestIdx] = true;
        visitedCount++;
        totalDistance += minDistance;
        tourIndices.push_back(nearestIdx);
        current = nearestIdx;
    }

    // Requirement (5): Return to warehouse to close the delivery loop
    double returnDist = matrix.getDistance(current, 0);
    if (returnDist >= (std::numeric_limits<double>::infinity() / 2.0)) {
        result.success = false;
        result.errorMessage = "Cannot return to warehouse from final delivery stop";
        return result;
    }

    totalDistance += returnDist;
    tourIndices.push_back(0);

    auto endTime = std::chrono::high_resolution_clock::now();
    result.executionTimeMicroseconds =
        std::chrono::duration<double, std::micro>(endTime - startTime).count();

    result.success = true;
    result.tour = matrix.toIds(tourIndices);
    result.tourIndices = tourIndices;
    result.totalDistanceKm = totalDistance;

    return result;
}

} // namespace DeliveryOptimizer
