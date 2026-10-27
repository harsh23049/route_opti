#include "OrOpt.h"
#include <algorithm>

namespace DeliveryOptimizer {

namespace {
constexpr double kEpsilon = 1e-9;
constexpr int kMaxSegmentLength = 3;
} // namespace

int OrOpt::improve(std::vector<int>& tour, const DistanceMatrix& matrix, int maxMoves) {
    const int n = static_cast<int>(tour.size());
    auto d = [&](int a, int b) { return matrix.getDistance(a, b); };

    int moves = 0;
    bool improved = true;

    // First-improvement with a rescan after each move (indices shift on relocation).
    // O(N^2) per move is fine for delivery-sized tours; neighbor lists would help for thousands of stops.
    while (improved && moves < maxMoves) {
        improved = false;

        for (int len = 1; len <= kMaxSegmentLength && !improved; ++len) {
            // Segment tour[i..j] must not include the warehouse at index 0 or n-1.
            for (int i = 1; i + len <= n - 1 && !improved; ++i) {
                const int j = i + len - 1;
                const int prev = tour[i - 1];
                const int next = tour[j + 1];
                const int first = tour[i];
                const int last = tour[j];

                // Cost saved by cutting the segment out and closing the gap.
                const double removeGain = d(prev, first) + d(last, next) - d(prev, next);

                // Try every insertion edge (tour[p], tour[p+1]) that does not touch the segment.
                for (int p = 0; p < n - 1; ++p) {
                    if (p >= i - 1 && p <= j) continue;

                    const int a = tour[p];
                    const int b = tour[p + 1];
                    const double forward = d(a, first) + d(last, b) - d(a, b);
                    const double reversed = d(a, last) + d(first, b) - d(a, b);
                    const bool useReversed = reversed < forward;

                    if ((useReversed ? reversed : forward) - removeGain < -kEpsilon) {
                        std::vector<int> segment(tour.begin() + i, tour.begin() + j + 1);
                        if (useReversed) std::reverse(segment.begin(), segment.end());

                        tour.erase(tour.begin() + i, tour.begin() + j + 1);
                        // Insertion points after the removed segment shift left by len.
                        const int insertAt = (p < i) ? p + 1 : p + 1 - len;
                        tour.insert(tour.begin() + insertAt, segment.begin(), segment.end());

                        ++moves;
                        improved = true;
                        break;
                    }
                }
            }
        }
    }

    return moves;
}

} // namespace DeliveryOptimizer
