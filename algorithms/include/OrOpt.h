#ifndef OR_OPT_H
#define OR_OPT_H

#include "DistanceMatrix.h"
#include <vector>

namespace DeliveryOptimizer {

/**
 * Or-opt Local Search
 *
 * Logic:
 * Removes a segment of 1 to 3 consecutive customer stops and reinserts it (in either
 * orientation) between two other consecutive stops when that strictly shortens the tour.
 * Complements 2-Opt: 2-Opt untangles crossings, Or-opt fixes stops that sit on the
 * "wrong" part of an otherwise good tour.
 *
 * Invariants:
 * - The warehouse stays fixed at index 0 and index n-1.
 * - Every customer stop is still visited exactly once.
 *
 * Time Complexity:
 * - O(N^2) per scan (3 segment lengths x N positions x N insertion points), O(1) delta each.
 *
 * Space Complexity:
 * - O(N) for the moved segment.
 */
class OrOpt {
public:
    /**
     * Applies improving Or-opt moves to a closed tour [0, ..., 0] in place.
     * Returns the number of improving moves applied.
     */
    static int improve(std::vector<int>& tour, const DistanceMatrix& matrix, int maxMoves = 10000);
};

} // namespace DeliveryOptimizer

#endif // OR_OPT_H
