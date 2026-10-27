#ifndef OPTIMIZER_H
#define OPTIMIZER_H

#include "Graph.h"
#include "Dijkstra.h"
#include "DistanceMatrix.h"
#include "NearestNeighbor.h"
#include "TwoOpt.h"
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
    TourResult nearestNeighborTour;
    TwoOptResult twoOptTour;

    std::vector<std::string> initialFullRoadPath;
    std::vector<std::string> optimizedFullRoadPath;

    double totalPipelineExecutionTimeMicroseconds{0.0};
};

class Optimizer {
public:
    static std::string getEngineVersion();

    /**
     * Executes the full delivery optimization pipeline:
     * 1. Validates inputs & graph.
     * 2. Builds symmetric all-pairs Dijkstra distance matrix.
     * 3. Solves TSP using Nearest Neighbor heuristic.
     * 4. Improves the closed loop using 2-Opt local search while fixing the warehouse.
     * 5. Reconstructs complete turn-by-turn road paths.
     */
    static OptimizationPipelineResult runPipeline(const Graph& graph,
                                                  const std::string& warehouseId,
                                                  const std::vector<std::string>& stopIds);
};

} // namespace DeliveryOptimizer

#endif // OPTIMIZER_H
