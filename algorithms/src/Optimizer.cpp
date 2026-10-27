#include "Optimizer.h"
#include <chrono>

namespace DeliveryOptimizer {

std::string Optimizer::getEngineVersion() {
    return "1.1.0-core-algorithms";
}

OptimizationPipelineResult Optimizer::runPipeline(const Graph& graph,
                                                  const std::string& warehouseId,
                                                  const std::vector<std::string>& stopIds) {
    auto startTime = std::chrono::high_resolution_clock::now();
    OptimizationPipelineResult pipelineRes;

    // Step 1 & 2: Build symmetric distance matrix using Dijkstra
    std::string matrixErr;
    bool matrixOk = DistanceMatrix::build(graph, warehouseId, stopIds, pipelineRes.matrix, matrixErr);
    if (!matrixOk) {
        pipelineRes.success = false;
        pipelineRes.errorMessage = "Distance matrix build failed: " + matrixErr;
        return pipelineRes;
    }

    // Step 3: Run Nearest Neighbor
    pipelineRes.nearestNeighborTour = NearestNeighbor::solve(pipelineRes.matrix);
    if (!pipelineRes.nearestNeighborTour.success) {
        pipelineRes.success = false;
        pipelineRes.errorMessage = "Nearest Neighbor failed: " + pipelineRes.nearestNeighborTour.errorMessage;
        return pipelineRes;
    }

    // Step 4: Run 2-Opt optimization
    pipelineRes.twoOptTour = TwoOpt::optimize(pipelineRes.nearestNeighborTour, pipelineRes.matrix);
    if (!pipelineRes.twoOptTour.success) {
        pipelineRes.success = false;
        pipelineRes.errorMessage = "2-Opt optimization failed: " + pipelineRes.twoOptTour.errorMessage;
        return pipelineRes;
    }

    // Step 5: Expand both tours into full turn-by-turn road paths
    pipelineRes.initialFullRoadPath =
        RouteUtils::expandToFullRoadPath(pipelineRes.nearestNeighborTour.tour, pipelineRes.matrix);
    pipelineRes.optimizedFullRoadPath =
        RouteUtils::expandToFullRoadPath(pipelineRes.twoOptTour.optimizedTour, pipelineRes.matrix);

    auto endTime = std::chrono::high_resolution_clock::now();
    pipelineRes.totalPipelineExecutionTimeMicroseconds =
        std::chrono::duration<double, std::micro>(endTime - startTime).count();
    pipelineRes.success = true;

    return pipelineRes;
}

} // namespace DeliveryOptimizer
