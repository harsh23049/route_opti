#ifndef NEAREST_NEIGHBOR_H
#define NEAREST_NEIGHBOR_H

#include "DistanceMatrix.h"
#include <vector>
#include <string>

namespace DeliveryOptimizer {

/**
 * Result of a closed delivery tour computation.
 */
struct TourResult {
    bool success{false};
    std::string algorithm{"Nearest Neighbor"};
    std::vector<std::string> tour;      // Ordered sequence of node IDs starting and ending at warehouse
    std::vector<int> tourIndices;        // Ordered sequence of DistanceMatrix indices
    double totalDistanceKm{0.0};         // Total closed loop travel distance
    double executionTimeMicroseconds{0.0};
    std::string errorMessage{""};
};

/**
 * Nearest Neighbor Heuristic for the Traveling Salesperson Problem (TSP).
 * 
 * Logic:
 * 1. Starts at the warehouse (index 0).
 * 2. At each step, visits the nearest unvisited delivery stop according to the distance matrix.
 * 3. Once all required delivery stops have been visited, returns directly to the warehouse,
 *    completing a closed delivery loop.
 * 
 * Time Complexity:
 * - O(M^2), where M is the number of locations (warehouse + delivery stops).
 *   At each of the M steps, it scans up to M candidates.
 * 
 * Space Complexity:
 * - O(M) for the visited boolean tracker and tour sequence.
 */
class NearestNeighbor {
public:
    static TourResult solve(const DistanceMatrix& matrix);
};

} // namespace DeliveryOptimizer

#endif // NEAREST_NEIGHBOR_H
