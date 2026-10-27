#ifndef DISTANCE_MATRIX_H
#define DISTANCE_MATRIX_H

#include "Graph.h"
#include "Dijkstra.h"
#include <vector>
#include <string>
#include <unordered_map>

namespace DeliveryOptimizer {

/**
 * Encapsulates the symmetric distance matrix and road paths between the warehouse
 * and all designated delivery stops.
 * 
 * Invariants:
 * - locationIds[0] is always the warehouse.
 * - locationIds[1..M-1] are customer delivery stops.
 * - Because the road graph is undirected, distances[i][j] == distances[j][i] (Symmetric TSP).
 * - distances[i][i] == 0.0.
 */
class DistanceMatrix {
public:
    DistanceMatrix() = default;

    /**
     * Constructs the all-pairs shortest road distance matrix between the warehouse and stops.
     * Validates that all locations exist in the graph and are mutually reachable.
     * Returns true if matrix successfully built; false if any node is invalid or unreachable.
     */
    static bool build(const Graph& graph,
                      const std::string& warehouseId,
                      const std::vector<std::string>& stopIds,
                      DistanceMatrix& outMatrix,
                      std::string& errorMessage);

    bool isValid() const { return valid_; }
    size_t size() const { return locationIds_.size(); }
    const std::string& getWarehouseId() const;
    const std::vector<std::string>& getLocationIds() const { return locationIds_; }

    int getIndex(const std::string& id) const;
    std::vector<std::string> toIds(const std::vector<int>& indices) const;
    bool hasLocation(const std::string& id) const;

    double getDistance(int i, int j) const;
    double getDistance(const std::string& u, const std::string& v) const;

    // Road-level node sequence for leg i -> j, rebuilt on demand from the Dijkstra predecessor tree.
    std::vector<std::string> getRoadPath(int i, int j) const;
    std::vector<std::string> getRoadPath(const std::string& u, const std::string& v) const;

    /**
     * Verifies that distances[i][j] == distances[j][i] within floating-point tolerance.
     */
    bool isSymmetric(double tolerance = 1e-6) const;

    double getBuildTimeMicroseconds() const { return buildTimeMicroseconds_; }

private:
    bool valid_{false};
    std::string warehouseId_;
    std::vector<std::string> locationIds_;
    std::unordered_map<std::string, int> idToIndex_;

    // M x M symmetric distance matrix
    std::vector<std::vector<double>> distances_;

    // M x V Dijkstra predecessor trees (one per location). Paths are rebuilt on demand,
    // keeping memory at O(M * V) instead of O(M^2 * pathLength).
    std::vector<std::vector<int>> parents_;
    std::vector<int> graphIndex_;       // location index -> graph node index
    std::vector<std::string> nodeIds_;  // graph node index -> node ID

    double buildTimeMicroseconds_{0.0};
};

} // namespace DeliveryOptimizer

#endif // DISTANCE_MATRIX_H
