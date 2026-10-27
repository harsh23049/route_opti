#ifndef FLEET_H
#define FLEET_H

#include "DistanceMatrix.h"
#include <vector>

namespace DeliveryOptimizer {

/** One van's closed trip [0, stops..., 0] in distance matrix indices. */
struct VehicleRoute {
    std::vector<int> tour;
    double distanceKm{0.0};
};

struct FleetPlan {
    std::vector<VehicleRoute> routes;   // only vans that got at least one stop
    double totalDistanceKm{0.0};
    double longestRouteKm{0.0};         // when the last van is back at the depot
};

/**
 * Multi-Vehicle Routing: Route First, Cluster Second (Beasley 1983)
 *
 * Logic:
 * 1. Start from a good single-vehicle "giant tour" over all stops (the TSP pipeline output).
 * 2. Split: cut the giant tour into at most K consecutive trips so that the longest trip is
 *    as short as possible, breaking ties toward a shorter total. Dynamic programming over
 *    the cut points (Prins 2004, min-max variant); exact for the given stop order.
 * 3. Re-optimize every trip on its own with 2-Opt and Or-opt.
 * 4. Balance: move single stops off the longest trip to another trip while that shortens
 *    the longest trip (inter-route relocate), re-optimizing both trips after each move.
 *
 * Objective: the longest route (all deliveries finish sooner). Total distance alone would
 * always favour a single van, since splitting a tour never shortens it.
 *
 * Time Complexity:  O(K * N^2) for the split; O(N^2) per balancing move, plus local search.
 * Space Complexity: O(K * N).
 */
class Fleet {
public:
    static constexpr int kMaxVehicles = 10;

    /**
     * Splits each candidate giant tour and keeps the best plan. Passing the baseline's tour
     * as a candidate guarantees the plan is never worse than that baseline.
     */
    static FleetPlan plan(const std::vector<std::vector<int>>& giantTours,
                          const DistanceMatrix& matrix, int vehicles);

    /** Baseline a dispatcher might use: equal-size consecutive chunks of a tour, as is. */
    static FleetPlan chunk(const std::vector<int>& giantTour, const DistanceMatrix& matrix, int vehicles);
};

} // namespace DeliveryOptimizer

#endif // FLEET_H
