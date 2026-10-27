#include "HeldKarp.h"
#include <algorithm>
#include <chrono>
#include <limits>

namespace DeliveryOptimizer {

TourResult HeldKarp::solve(const DistanceMatrix& matrix) {
    auto startTime = std::chrono::high_resolution_clock::now();

    TourResult result;
    result.algorithm = "Held-Karp Exact DP";

    if (!matrix.isValid() || matrix.size() == 0) {
        result.errorMessage = "Cannot run Held-Karp: Distance matrix is invalid";
        return result;
    }

    // Customers are matrix indices 1..n; customer c maps to bit (c - 1).
    const int n = static_cast<int>(matrix.size()) - 1;
    if (n > kMaxStops) {
        result.errorMessage = "Held-Karp skipped: " + std::to_string(n) +
                              " stops exceeds the exact-solver limit of " + std::to_string(kMaxStops);
        return result;
    }

    std::vector<int> tourIndices{0};
    double best = 0.0;

    if (n > 0) {
        const double inf = std::numeric_limits<double>::infinity();
        const size_t full = size_t{1} << n;
        std::vector<double> dp(full * n, inf);
        std::vector<int> parent(full * n, -1);

        for (int j = 0; j < n; ++j) {
            dp[(size_t{1} << j) * n + j] = matrix.getDistance(0, j + 1);
        }

        for (size_t mask = 1; mask < full; ++mask) {
            for (int j = 0; j < n; ++j) {
                if (!(mask & (size_t{1} << j))) continue;
                const double cost = dp[mask * n + j];
                if (cost == inf) continue;

                for (int k = 0; k < n; ++k) {
                    if (mask & (size_t{1} << k)) continue;
                    const size_t nextMask = mask | (size_t{1} << k);
                    const double candidate = cost + matrix.getDistance(j + 1, k + 1);
                    if (candidate < dp[nextMask * n + k]) {
                        dp[nextMask * n + k] = candidate;
                        parent[nextMask * n + k] = j;
                    }
                }
            }
        }

        best = inf;
        int last = -1;
        for (int j = 0; j < n; ++j) {
            const double candidate = dp[(full - 1) * n + j] + matrix.getDistance(j + 1, 0);
            if (candidate < best) {
                best = candidate;
                last = j;
            }
        }

        // Walk parent pointers back from the full set to rebuild the visiting order.
        std::vector<int> order;
        size_t mask = full - 1;
        for (int j = last; j != -1;) {
            order.push_back(j + 1);
            const int prev = parent[mask * n + j];
            mask &= ~(size_t{1} << j);
            j = prev;
        }
        std::reverse(order.begin(), order.end());
        tourIndices.insert(tourIndices.end(), order.begin(), order.end());
    }

    tourIndices.push_back(0);

    auto endTime = std::chrono::high_resolution_clock::now();
    result.executionTimeMicroseconds =
        std::chrono::duration<double, std::micro>(endTime - startTime).count();

    result.success = true;
    result.tour = matrix.toIds(tourIndices);
    result.tourIndices = tourIndices;
    result.totalDistanceKm = best;
    return result;
}

} // namespace DeliveryOptimizer
