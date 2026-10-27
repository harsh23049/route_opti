#ifndef OPTIMIZER_H
#define OPTIMIZER_H

#include "Graph.h"
#include "Dijkstra.h"
#include "DistanceMatrix.h"
#include "NearestNeighbor.h"
#include "TwoOpt.h"
#include "OrOpt.h"
#include "HeldKarp.h"
#include "Fleet.h"
#include "RouteUtils.h"

#include <string>
#include <vector>

namespace DeliveryOptimizer {

/**
 * High-level optimization pipeline result bundling all metrics and steps.
 */
struct OptimizationPipelineResult {
    bool success{false};
    std::string errorMessage{""};

    DistanceMatrix matrix;
    TourResult nearestNeighborTour;   // Stage 1: greedy construction
    TwoOptResult twoOptTour;          // Stage 2: NN improved by 2-Opt alone
    TourResult optimizedTour;         // Stage 3: alternating Or-opt / 2-Opt until neither improves
    int orOptMoves{0};
    TourResult exactTour;             // Held-Karp optimum; success == false when skipped (too many stops)

    int vehicles{1};
    FleetPlan fleetBaseline;          // vehicles > 1: NN tour cut into equal chunks
    FleetPlan fleetOptimized;         // vehicles > 1: route-first cluster-second split

    double totalPipelineExecutionTimeMicroseconds{0.0};
};

class Optimizer {
public:
    static std::string getEngineVersion();

    /**
     * Executes the full delivery optimization pipeline:
     * 1. Builds the symmetric all-pairs Dijkstra distance matrix (validates IDs and reachability).
     * 2. Constructs an initial tour with the Nearest Neighbor heuristic.
     * 3. Improves it with 2-Opt local search (warehouse fixed at both ends).
     * 4. Alternates Or-opt and 2-Opt until neither finds an improving move.
     * 5. Solves the exact optimum with Held-Karp when stops <= HeldKarp::kMaxStops.
     * 6. With vehicles > 1, splits the best tour into per-van routes (see Fleet).
     */
    static OptimizationPipelineResult runPipeline(const Graph& graph,
                                                  const std::string& warehouseId,
                                                  const std::vector<std::string>& stopIds,
                                                  int vehicles = 1);
};

} // namespace DeliveryOptimizer

#endif // OPTIMIZER_H
