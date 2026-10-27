#include "Optimizer.h"
#include <chrono>

namespace DeliveryOptimizer {

namespace {
// Each round is one Or-opt sweep plus one 2-Opt sweep; real tours converge in a handful.
constexpr int kMaxLocalSearchRounds = 100;
} // namespace

std::string Optimizer::getEngineVersion() {
    return "2.1.0";
}

OptimizationPipelineResult Optimizer::runPipeline(const Graph& graph,
                                                  const std::string& warehouseId,
                                                  const std::vector<std::string>& stopIds,
                                                  int vehicles) {
    auto startTime = std::chrono::high_resolution_clock::now();
    OptimizationPipelineResult pipelineRes;

    // Step 1: Build symmetric distance matrix using Dijkstra
    std::string matrixErr;
    bool matrixOk = DistanceMatrix::build(graph, warehouseId, stopIds, pipelineRes.matrix, matrixErr);
    if (!matrixOk) {
        pipelineRes.success = false;
        pipelineRes.errorMessage = "Distance matrix build failed: " + matrixErr;
        return pipelineRes;
    }
    const DistanceMatrix& matrix = pipelineRes.matrix;

    // Step 2: Run Nearest Neighbor
    pipelineRes.nearestNeighborTour = NearestNeighbor::solve(matrix);
    if (!pipelineRes.nearestNeighborTour.success) {
        pipelineRes.success = false;
        pipelineRes.errorMessage = "Nearest Neighbor failed: " + pipelineRes.nearestNeighborTour.errorMessage;
        return pipelineRes;
    }

    // Step 3: Run 2-Opt optimization
    pipelineRes.twoOptTour = TwoOpt::optimize(pipelineRes.nearestNeighborTour, matrix);
    if (!pipelineRes.twoOptTour.success) {
        pipelineRes.success = false;
        pipelineRes.errorMessage = "2-Opt optimization failed: " + pipelineRes.twoOptTour.errorMessage;
        return pipelineRes;
    }

    // Step 4: Or-opt relocations can expose new 2-Opt moves (and vice versa), so alternate
    // until Or-opt finds nothing or the following 2-Opt sweep changes nothing.
    std::vector<int> tour = pipelineRes.twoOptTour.optimizedTourIndices;
    for (int round = 0; round < kMaxLocalSearchRounds; ++round) {
        const int moved = OrOpt::improve(tour, matrix);
        pipelineRes.orOptMoves += moved;
        if (moved == 0 || TwoOpt::improve(tour, matrix) == 0) break;
    }

    TourResult& optimized = pipelineRes.optimizedTour;
    optimized.success = true;
    optimized.algorithm = "Nearest Neighbor + 2-Opt + Or-opt";
    optimized.tourIndices = tour;
    optimized.tour = matrix.toIds(tour);
    optimized.totalDistanceKm = TwoOpt::computeTourDistance(tour, matrix);

    // Step 5: Exact optimum as ground truth for small instances
    if (matrix.size() - 1 <= static_cast<size_t>(HeldKarp::kMaxStops)) {
        pipelineRes.exactTour = HeldKarp::solve(matrix);
    }

    // Step 6: Multi-vehicle plan. The NN tour is a candidate too, so the plan is never
    // worse than the equal-chunks baseline cut from it.
    pipelineRes.vehicles = vehicles;
    if (vehicles > 1) {
        const std::vector<int>& nnTour = pipelineRes.nearestNeighborTour.tourIndices;
        const std::vector<int>& bestTour =
            pipelineRes.exactTour.success ? pipelineRes.exactTour.tourIndices : tour;
        pipelineRes.fleetBaseline = Fleet::chunk(nnTour, matrix, vehicles);
        pipelineRes.fleetOptimized = Fleet::plan({bestTour, nnTour}, matrix, vehicles);
    }

    auto endTime = std::chrono::high_resolution_clock::now();
    pipelineRes.totalPipelineExecutionTimeMicroseconds =
        std::chrono::duration<double, std::micro>(endTime - startTime).count();
    pipelineRes.success = true;

    return pipelineRes;
}

} // namespace DeliveryOptimizer
