#include "TwoOpt.h"
#include <algorithm>
#include <chrono>

namespace DeliveryOptimizer {

namespace {
// Moves must beat this to count, so floating-point noise cannot cause endless swaps.
constexpr double kEpsilon = 1e-9;
} // namespace

double TwoOpt::computeTourDistance(const std::vector<int>& tourIndices,
                                  const DistanceMatrix& matrix) {
    if (tourIndices.size() < 2) return 0.0;
    double dist = 0.0;
    for (size_t i = 0; i < tourIndices.size() - 1; ++i) {
        dist += matrix.getDistance(tourIndices[i], tourIndices[i + 1]);
    }
    return dist;
}

int TwoOpt::improve(std::vector<int>& tour, const DistanceMatrix& matrix, int maxPasses) {
    const size_t n = tour.size();
    // A tour of length <= 3 has <= 1 customer stop (e.g., [W, W] or [W, S1, W]).
    // Subsegment reversal requires at least 2 intermediate customer stops.
    if (n <= 3) return 0;

    int moves = 0;
    bool improved = true;

    // Requirement (6): Keep the warehouse fixed at both ends (index 0 and index n - 1).
    // Candidate subsegments [i, k] range from index 1 to n - 2.
    for (int pass = 0; improved && pass < maxPasses; ++pass) {
        improved = false;

        for (size_t i = 1; i < n - 2; ++i) {
            for (size_t k = i + 1; k < n - 1; ++k) {
                // Current edges: (a -> b) and (c -> d). After reversing [i, k]: (a -> c) and (b -> d).
                // Internal subsegment distances stay the same because the road distance matrix
                // is symmetric for an undirected graph (dist(x, y) == dist(y, x)).
                const int a = tour[i - 1];
                const int b = tour[i];
                const int c = tour[k];
                const int d = tour[k + 1];

                const double delta = matrix.getDistance(a, c) + matrix.getDistance(b, d)
                                   - matrix.getDistance(a, b) - matrix.getDistance(c, d);

                // Apply and keep scanning the updated tour instead of restarting from i = 1;
                // a pass ends only after every (i, k) pair has been checked.
                if (delta < -kEpsilon) {
                    std::reverse(tour.begin() + i, tour.begin() + k + 1);
                    ++moves;
                    improved = true;
                }
            }
        }
    }

    return moves;
}

TwoOptResult TwoOpt::optimize(const TourResult& initialTour,
                             const DistanceMatrix& matrix,
                             int maxPasses) {
    auto startTime = std::chrono::high_resolution_clock::now();

    TwoOptResult result;
    result.algorithm = "2-Opt Local Search";
    result.initialTour = initialTour.tour;
    result.initialDistanceKm = initialTour.totalDistanceKm;

    if (!initialTour.success) {
        result.success = false;
        result.errorMessage = "Cannot optimize invalid initial tour: " + initialTour.errorMessage;
        return result;
    }

    if (!matrix.isValid()) {
        result.success = false;
        result.errorMessage = "Cannot run 2-Opt: Distance matrix is invalid";
        return result;
    }

    std::vector<int> tour = initialTour.tourIndices;
    const int moves = improve(tour, matrix, maxPasses);
    const double finalDist = moves > 0 ? computeTourDistance(tour, matrix) : initialTour.totalDistanceKm;

    double saved = initialTour.totalDistanceKm - finalDist;
    if (saved < 0.0) saved = 0.0;

    double pct = 0.0;
    if (initialTour.totalDistanceKm > 0.0) {
        pct = (saved / initialTour.totalDistanceKm) * 100.0;
    }

    auto endTime = std::chrono::high_resolution_clock::now();
    result.executionTimeMicroseconds =
        std::chrono::duration<double, std::micro>(endTime - startTime).count();

    result.success = true;
    result.optimizedTour = matrix.toIds(tour);
    result.optimizedTourIndices = tour;
    result.optimizedDistanceKm = finalDist;
    result.distanceSavedKm = saved;
    result.percentageImprovement = pct;
    result.iterations = moves;

    return result;
}

} // namespace DeliveryOptimizer
