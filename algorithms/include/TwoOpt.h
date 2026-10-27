#ifndef TWO_OPT_H
#define TWO_OPT_H

#include "DistanceMatrix.h"
#include "NearestNeighbor.h"
#include <vector>
#include <string>

namespace DeliveryOptimizer {

/**
 * Result of the 2-Opt local search route optimization.
 */
struct TwoOptResult {
    bool success{false};
    std::string algorithm{"2-Opt Local Search"};
    std::vector<std::string> initialTour;     // Starting tour from Nearest Neighbor
    std::vector<std::string> optimizedTour;   // Tour after 2-opt untangling
    std::vector<int> optimizedTourIndices;    // Distance matrix indices of optimized tour

    double initialDistanceKm{0.0};
    double optimizedDistanceKm{0.0};
    double distanceSavedKm{0.0};
    double percentageImprovement{0.0};

    int iterations{0};                        // Number of successful 2-opt improvements
    double executionTimeMicroseconds{0.0};    // High-resolution compute time
    std::string errorMessage{""};
};

/**
 * 2-Opt Local Search Algorithm
 * 
 * Logic:
 * Iteratively considers pairs of non-adjacent edges in the tour and reverses the intermediate
 * segment if doing so strictly reduces total tour length (untangling route crossings).
 * 
 * Invariants:
 * - The warehouse remains strictly fixed at the start (index 0) and at the end (index n-1).
 *   Only customer delivery stops (indices 1 to n-2) are candidates for segment reversal.
 * - Leverages the symmetric distance matrix property (dist(u, v) == dist(v, u)) of the
 *   undirected road network for O(1) delta-cost evaluation per pair.
 * 
 * Time Complexity:
 * - O(N^2) per pass over all (i, k) candidate pairs, where N is the number of stops.
 *   Improving moves are applied in place and the pass continues; passes repeat until one
 *   finds no improving move (a 2-opt local optimum) or maxPasses is reached.
 *
 * Space Complexity:
 * - O(N) auxiliary space to store the tour index array.
 */
class TwoOpt {
public:
    static TwoOptResult optimize(const TourResult& initialTour,
                                 const DistanceMatrix& matrix,
                                 int maxPasses = 1000);

    /**
     * Runs 2-opt passes on a closed tour [0, ..., 0] in place.
     * Returns the number of improving moves applied.
     */
    static int improve(std::vector<int>& tour, const DistanceMatrix& matrix, int maxPasses = 1000);

    /**
     * Calculates the exact total distance of a tour sequence from the distance matrix.
     */
    static double computeTourDistance(const std::vector<int>& tourIndices,
                                      const DistanceMatrix& matrix);
};

} // namespace DeliveryOptimizer

#endif // TWO_OPT_H
