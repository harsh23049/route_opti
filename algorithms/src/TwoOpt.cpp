#include "TwoOpt.h"
#include <algorithm>
#include <chrono>

namespace DeliveryOptimizer {

double TwoOpt::computeTourDistance(const std::vector<int>& tourIndices,
                                  const DistanceMatrix& matrix) {
    if (tourIndices.size() < 2) return 0.0;
    double dist = 0.0;
    for (size_t i = 0; i < tourIndices.size() - 1; ++i) {
        dist += matrix.getDistance(tourIndices[i], tourIndices[i + 1]);
    }
    return dist;
}

TwoOptResult TwoOpt::optimize(const TourResult& initialTour,
                             const DistanceMatrix& matrix,
                             int maxIterations) {
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
    size_t n = tour.size();

    // A tour of length <= 3 has <= 1 customer stop (e.g., [W, W] or [W, S1, W]).
    // Subsegment reversal requires at least 2 intermediate customer stops.
    if (n <= 3) {
        result.success = true;
        result.optimizedTour = initialTour.tour;
        result.optimizedTourIndices = tour;
        result.optimizedDistanceKm = initialTour.totalDistanceKm;
        result.distanceSavedKm = 0.0;
        result.percentageImprovement = 0.0;
        result.iterations = 0;

        auto endTime = std::chrono::high_resolution_clock::now();
        result.executionTimeMicroseconds =
            std::chrono::duration<double, std::micro>(endTime - startTime).count();
        return result;
    }

    bool improvementFound = true;
    int iterationCount = 0;

    // Requirement (6): Keep the warehouse fixed at both ends (index 0 and index n - 1).
    // Candidate subsegments [i, k] range from index 1 to n - 2.
    while (improvementFound && iterationCount < maxIterations) {
        improvementFound = false;

        for (size_t i = 1; i < n - 2; ++i) {
            for (size_t k = i + 1; k < n - 1; ++k) {
                int u1 = tour[i - 1];
                int v1 = tour[i];
                int u2 = tour[k];
                int v2 = tour[k + 1];

                // Current edges: (u1 -> v1) and (u2 -> v2)
                double currentEdgeCost = matrix.getDistance(u1, v1) + matrix.getDistance(u2, v2);

                // Proposed edges after reversing subsegment [i, k]: (u1 -> u2) and (v1 -> v2)
                // Note: Internal subsegment distances remain invariant because the road distance matrix
                // is strictly symmetric for an undirected graph (dist(a, b) == dist(b, a)).
                double proposedEdgeCost = matrix.getDistance(u1, u2) + matrix.getDistance(v1, v2);

                double delta = proposedEdgeCost - currentEdgeCost;

                // Check for strict improvement beyond floating-point epsilon
                if (delta < -1e-9) {
                    std::reverse(tour.begin() + i, tour.begin() + k + 1);
                    improvementFound = true;
                    iterationCount++;
                    break; // Restart scan with improved tour
                }
            }
            if (improvementFound) {
                break;
            }
        }
    }

    // Recompute total optimized tour distance
    double finalDist = computeTourDistance(tour, matrix);

    // Build node ID tour for display/output
    const std::vector<std::string>& locIds = matrix.getLocationIds();
    std::vector<std::string> optimizedIdTour;
    optimizedIdTour.reserve(tour.size());
    for (int idx : tour) {
        optimizedIdTour.push_back(locIds[idx]);
    }

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
    result.optimizedTour = optimizedIdTour;
    result.optimizedTourIndices = tour;
    result.optimizedDistanceKm = finalDist;
    result.distanceSavedKm = saved;
    result.percentageImprovement = pct;
    result.iterations = iterationCount;

    return result;
}

} // namespace DeliveryOptimizer
