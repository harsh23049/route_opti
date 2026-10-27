#ifndef HELD_KARP_H
#define HELD_KARP_H

#include "DistanceMatrix.h"
#include "NearestNeighbor.h"

namespace DeliveryOptimizer {

/**
 * Held-Karp Dynamic Programming (exact TSP)
 *
 * Logic:
 * dp[S][j] = shortest path that starts at the warehouse, visits exactly the customer set S,
 * and ends at customer j. dp[S + {k}][k] = min over j of dp[S][j] + dist(j, k).
 * The optimal tour closes the loop from the best final customer back to the warehouse.
 *
 * Used as ground truth: the pipeline reports how far the heuristic tour is from optimal.
 *
 * Time Complexity:  O(2^N * N^2), N = number of customer stops.
 * Space Complexity: O(2^N * N).
 * With N = kMaxStops = 15 that is ~7.4M transitions and ~6 MB, a few milliseconds.
 */
class HeldKarp {
public:
    static constexpr int kMaxStops = 15;

    /**
     * Returns the optimal closed tour. Fails (success = false) when the matrix has more
     * than kMaxStops customer stops.
     */
    static TourResult solve(const DistanceMatrix& matrix);
};

} // namespace DeliveryOptimizer

#endif // HELD_KARP_H
