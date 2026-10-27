#include "Graph.h"
#include "Dijkstra.h"
#include "DistanceMatrix.h"
#include "NearestNeighbor.h"
#include "TwoOpt.h"
#include "OrOpt.h"
#include "HeldKarp.h"
#include "Optimizer.h"
#include "RouteUtils.h"
#include "Json.h"
#include "JsonInterface.h"

#include <iostream>
#include <iomanip>
#include <vector>
#include <string>
#include <algorithm>
#include <numeric>
#include <cmath>
#include <limits>
#include <random>
#include <sstream>
#include <unordered_map>
#include <unordered_set>

using namespace DeliveryOptimizer;

// =============================================================================
// Lightweight Test Harness
// =============================================================================
static int gTotalTests = 0;
static int gPassedTests = 0;
static int gFailedTests = 0;

#define TEST_ASSERT(cond, msg) \
    do { \
        gTotalTests++; \
        if (cond) { \
            gPassedTests++; \
        } else { \
            gFailedTests++; \
            std::cerr << "  [FAIL] " << msg << " (Line " << __LINE__ << ")\n"; \
        } \
    } while (0)

#define ASSERT_NEAR(a, b, eps) \
    TEST_ASSERT(std::abs((a) - (b)) <= (eps), "Expected " #a " (" + std::to_string(a) + ") ~ " #b " (" + std::to_string(b) + ") within eps=" + std::to_string(eps))

#define ASSERT_EQ(a, b) \
    TEST_ASSERT((a) == (b), "Expected " #a " == " #b)

#define ASSERT_TRUE(a) \
    TEST_ASSERT((a), "Expected true: " #a)

#define ASSERT_FALSE(a) \
    TEST_ASSERT(!(a), "Expected false: " #a)

// =============================================================================
// Helper: Brute-Force TSP Solver (Test Code Only)
// Enumerates all permutations of customer stops to compute the globally optimal tour cost.
// =============================================================================
struct BruteForceTspResult {
    double optimalCost{std::numeric_limits<double>::infinity()};
    std::vector<int> optimalTourIndices;
};

BruteForceTspResult solveBruteForceTSP(const DistanceMatrix& matrix) {
    BruteForceTspResult result;
    size_t m = matrix.size();
    if (m <= 1) {
        result.optimalCost = 0.0;
        result.optimalTourIndices = {0, 0};
        return result;
    }
    if (m == 2) {
        result.optimalCost = matrix.getDistance(0, 1) + matrix.getDistance(1, 0);
        result.optimalTourIndices = {0, 1, 0};
        return result;
    }

    // Customer stops are indices 1 to m-1
    std::vector<int> customerIndices(m - 1);
    std::iota(customerIndices.begin(), customerIndices.end(), 1);

    do {
        double currentCost = 0.0;
        // Warehouse -> first customer
        currentCost += matrix.getDistance(0, customerIndices.front());

        // Consecutive customers
        for (size_t i = 0; i < customerIndices.size() - 1; ++i) {
            currentCost += matrix.getDistance(customerIndices[i], customerIndices[i + 1]);
        }

        // Last customer -> Warehouse
        currentCost += matrix.getDistance(customerIndices.back(), 0);

        if (currentCost < result.optimalCost) {
            result.optimalCost = currentCost;
            result.optimalTourIndices.clear();
            result.optimalTourIndices.push_back(0);
            result.optimalTourIndices.insert(result.optimalTourIndices.end(),
                                            customerIndices.begin(),
                                            customerIndices.end());
            result.optimalTourIndices.push_back(0);
        }
    } while (std::next_permutation(customerIndices.begin(), customerIndices.end()));

    return result;
}

// =============================================================================
// Test Suite 1: Dijkstra Shortest Path vs Manually Verified Ground Truth
// =============================================================================
void testDijkstraManuallyVerified() {
    std::cout << "[RUN] testDijkstraManuallyVerified...\n";

    // Graph layout:
    // A -> B (4.0), A -> C (2.0)
    // C -> B (1.5)  => A->C->B (3.5) is strictly shorter than direct A->B (4.0)
    // B -> E (2.0), C -> E (10.0)
    // B -> D (5.0), E -> D (1.0) => B->E->D (3.0) is shorter than B->D (5.0)
    // Optimal path from A to D: A -> C -> B -> E -> D
    // Distance: 2.0 + 1.5 + 2.0 + 1.0 = 6.5
    Graph g;
    g.addNode("A"); g.addNode("B"); g.addNode("C"); g.addNode("D"); g.addNode("E");
    g.addEdge("A", "B", 4.0, "Direct AB");
    g.addEdge("A", "C", 2.0, "AC Road");
    g.addEdge("C", "B", 1.5, "CB Shortcut");
    g.addEdge("B", "D", 5.0, "Direct BD");
    g.addEdge("C", "E", 10.0, "CE Highroad");
    g.addEdge("B", "E", 2.0, "BE Avenue");
    g.addEdge("E", "D", 1.0, "ED Lane");

    DijkstraResult res = Dijkstra::findShortestPath(g, "A", "D");
    ASSERT_TRUE(res.reachable);
    ASSERT_NEAR(res.distanceKm, 6.5, 1e-6);

    std::vector<std::string> expectedPath = {"A", "C", "B", "E", "D"};
    ASSERT_EQ(res.pathNodes.size(), expectedPath.size());
    for (size_t i = 0; i < expectedPath.size(); ++i) {
        ASSERT_EQ(res.pathNodes[i], expectedPath[i]);
    }

    std::vector<std::string> expectedStreets = {"AC Road", "CB Shortcut", "BE Avenue", "ED Lane"};
    ASSERT_EQ(res.streetNames.size(), expectedStreets.size());
    for (size_t i = 0; i < expectedStreets.size(); ++i) {
        ASSERT_EQ(res.streetNames[i], expectedStreets[i]);
    }
}

// =============================================================================
// Test Suite 2: Unreachable Vertices & Disconnected Components
// =============================================================================
void testUnreachableVertices() {
    std::cout << "[RUN] testUnreachableVertices...\n";

    Graph g;
    // Component 1: W, S1, S2
    g.addNode("W"); g.addNode("S1"); g.addNode("S2");
    g.addEdge("W", "S1", 2.0);
    g.addEdge("S1", "S2", 3.0);

    // Component 2 (Disconnected island): ISO1, ISO2
    g.addNode("ISO1"); g.addNode("ISO2");
    g.addEdge("ISO1", "ISO2", 1.0);

    // 1. Direct point-to-point Dijkstra to unreachable vertex
    DijkstraResult dRes = Dijkstra::findShortestPath(g, "W", "ISO1");
    ASSERT_FALSE(dRes.reachable);
    ASSERT_TRUE(dRes.distanceKm > 1e12);
    ASSERT_TRUE(dRes.pathNodes.empty());

    // 2. DistanceMatrix::build must fail when an unreachable stop is included
    DistanceMatrix matrix;
    std::string errMsg;
    bool built = DistanceMatrix::build(g, "W", {"S1", "ISO1"}, matrix, errMsg);
    ASSERT_FALSE(built);
    ASSERT_FALSE(matrix.isValid());
    ASSERT_TRUE(errMsg.find("Unreachable location") != std::string::npos);
}

// =============================================================================
// Test Suite 3: Nearest-Neighbor Route Invariants
// =============================================================================
void testNearestNeighborProperties() {
    std::cout << "[RUN] testNearestNeighborProperties...\n";

    Graph g;
    std::vector<std::string> nodes = {"W", "C1", "C2", "C3", "C4", "C5"};
    for (const auto& id : nodes) g.addNode(id);

    // Connect in a ring with chords
    g.addEdge("W", "C1", 2.0);
    g.addEdge("C1", "C2", 2.5);
    g.addEdge("C2", "C3", 1.8);
    g.addEdge("C3", "C4", 3.2);
    g.addEdge("C4", "C5", 2.1);
    g.addEdge("C5", "W", 4.0);
    g.addEdge("W", "C3", 5.0);
    g.addEdge("C1", "C4", 4.5);

    DistanceMatrix matrix;
    std::string errMsg;
    std::vector<std::string> customerStops = {"C1", "C2", "C3", "C4", "C5"};
    bool built = DistanceMatrix::build(g, "W", customerStops, matrix, errMsg);
    ASSERT_TRUE(built);

    TourResult nnRes = NearestNeighbor::solve(matrix);
    ASSERT_TRUE(nnRes.success);

    // Invariant 1: Starts and ends at the warehouse
    ASSERT_EQ(nnRes.tour.front(), "W");
    ASSERT_EQ(nnRes.tour.back(), "W");

    // Invariant 2: Exactly M + 1 stops in closed tour (W + M-1 customers + W)
    ASSERT_EQ(nnRes.tour.size(), customerStops.size() + 2);

    // Invariant 3: Every required customer stop visited EXACTLY ONCE
    std::unordered_map<std::string, int> visitCounts;
    for (size_t i = 1; i < nnRes.tour.size() - 1; ++i) {
        visitCounts[nnRes.tour[i]]++;
    }
    for (const auto& c : customerStops) {
        ASSERT_EQ(visitCounts[c], 1);
    }

    // Invariant 4: Route distance matches the sum of consecutive matrix edges
    double manualSum = 0.0;
    for (size_t i = 0; i < nnRes.tour.size() - 1; ++i) {
        double d = matrix.getDistance(nnRes.tour[i], nnRes.tour[i + 1]);
        manualSum += d;
    }
    ASSERT_NEAR(nnRes.totalDistanceKm, manualSum, 1e-6);
}

// =============================================================================
// Test Suite 4: 2-Opt Invariants (Never Increases Cost, Preserves Fixed Warehouse)
// =============================================================================
void testTwoOptNeverIncreasesCost() {
    std::cout << "[RUN] testTwoOptNeverIncreasesCost...\n";

    // Setup an instance where nearest neighbor produces a known crossed tour
    Graph g;
    g.addNode("W"); g.addNode("S1"); g.addNode("S2"); g.addNode("S3"); g.addNode("S4");
    g.addNode("J1"); g.addNode("J2"); g.addNode("J3");

    g.addEdge("W", "J1", 1.8);
    g.addEdge("W", "J2", 2.0);
    g.addEdge("W", "J3", 1.6);
    g.addEdge("J2", "S1", 1.5);
    g.addEdge("J1", "S2", 0.8);
    g.addEdge("S1", "S2", 1.2);
    g.addEdge("S2", "S3", 1.1);
    g.addEdge("S3", "S4", 1.4);
    g.addEdge("J3", "S4", 1.9);
    g.addEdge("S4", "J2", 4.2);

    DistanceMatrix matrix;
    std::string errMsg;
    std::vector<std::string> stops = {"S1", "S2", "S3", "S4"};
    DistanceMatrix::build(g, "W", stops, matrix, errMsg);

    TourResult nnRes = NearestNeighbor::solve(matrix);
    TwoOptResult optRes = TwoOpt::optimize(nnRes, matrix);

    ASSERT_TRUE(optRes.success);

    // Invariant 1: 2-Opt cost <= Initial cost (NEVER increases cost)
    ASSERT_TRUE(optRes.optimizedDistanceKm <= nnRes.totalDistanceKm + 1e-9);
    ASSERT_TRUE(optRes.distanceSavedKm >= 0.0);

    // Invariant 2: Warehouse strictly fixed at both ends
    ASSERT_EQ(optRes.optimizedTour.front(), "W");
    ASSERT_EQ(optRes.optimizedTour.back(), "W");

    // Invariant 3: Every customer visited exactly once in intermediate stops
    std::unordered_map<std::string, int> visitCounts;
    for (size_t i = 1; i < optRes.optimizedTour.size() - 1; ++i) {
        visitCounts[optRes.optimizedTour[i]]++;
    }
    for (const auto& s : stops) {
        ASSERT_EQ(visitCounts[s], 1);
    }

    // Invariant 4: Optimized distance matches manual sum of consecutive matrix edges
    double manualSum = 0.0;
    for (size_t i = 0; i < optRes.optimizedTour.size() - 1; ++i) {
        manualSum += matrix.getDistance(optRes.optimizedTour[i], optRes.optimizedTour[i + 1]);
    }
    ASSERT_NEAR(optRes.optimizedDistanceKm, manualSum, 1e-6);
}

// =============================================================================
// Test Suite 5: Already Optimal or Non-Improvable Routes Remain Valid
// =============================================================================
void testAlreadyOptimalRoutes() {
    std::cout << "[RUN] testAlreadyOptimalRoutes...\n";

    // A triangle graph: Warehouse + 2 customers.
    // There is only 1 possible undirected tour: W -> A -> B -> W.
    Graph g;
    g.addNode("W"); g.addNode("A"); g.addNode("B");
    g.addEdge("W", "A", 3.0);
    g.addEdge("A", "B", 4.0);
    g.addEdge("B", "W", 5.0);

    DistanceMatrix matrix;
    std::string errMsg;
    DistanceMatrix::build(g, "W", {"A", "B"}, matrix, errMsg);

    TourResult nnRes = NearestNeighbor::solve(matrix);
    ASSERT_TRUE(nnRes.success);
    double initialCost = nnRes.totalDistanceKm;

    TwoOptResult optRes = TwoOpt::optimize(nnRes, matrix);
    ASSERT_TRUE(optRes.success);
    ASSERT_EQ(optRes.iterations, 0); // No swaps possible
    ASSERT_NEAR(optRes.optimizedDistanceKm, initialCost, 1e-6);
    ASSERT_NEAR(optRes.distanceSavedKm, 0.0, 1e-6);
    ASSERT_NEAR(optRes.percentageImprovement, 0.0, 1e-6);

    // Warehouse and customer positions preserved
    ASSERT_EQ(optRes.optimizedTour.front(), "W");
    ASSERT_EQ(optRes.optimizedTour.back(), "W");
    ASSERT_EQ(optRes.optimizedTour.size(), 4);
}

// =============================================================================
// Test Suite 6: Small Inputs & Invalid Inputs
// =============================================================================
void testSmallAndInvalidInputs() {
    std::cout << "[RUN] testSmallAndInvalidInputs...\n";

    Graph g;
    g.addNode("W");
    g.addNode("S1");
    g.addEdge("W", "S1", 3.2);

    // 1. Boundary case: Zero customer delivery stops (only warehouse)
    DistanceMatrix zeroMatrix;
    std::string errMsg;
    bool zeroOk = DistanceMatrix::build(g, "W", {}, zeroMatrix, errMsg);
    ASSERT_TRUE(zeroOk);
    TourResult zeroTour = NearestNeighbor::solve(zeroMatrix);
    ASSERT_TRUE(zeroTour.success);
    ASSERT_NEAR(zeroTour.totalDistanceKm, 0.0, 1e-6);
    ASSERT_EQ(zeroTour.tour.size(), 2);
    ASSERT_EQ(zeroTour.tour[0], "W");
    ASSERT_EQ(zeroTour.tour[1], "W");

    TwoOptResult zeroOpt = TwoOpt::optimize(zeroTour, zeroMatrix);
    ASSERT_TRUE(zeroOpt.success);
    ASSERT_NEAR(zeroOpt.optimizedDistanceKm, 0.0, 1e-6);
    ASSERT_EQ(zeroOpt.iterations, 0);

    // 2. Boundary case: Exactly 1 customer delivery stop: [W, S1, W]
    DistanceMatrix oneMatrix;
    bool oneOk = DistanceMatrix::build(g, "W", {"S1"}, oneMatrix, errMsg);
    ASSERT_TRUE(oneOk);
    TourResult oneTour = NearestNeighbor::solve(oneMatrix);
    ASSERT_TRUE(oneTour.success);
    ASSERT_NEAR(oneTour.totalDistanceKm, 6.4, 1e-6); // 3.2 + 3.2
    ASSERT_EQ(oneTour.tour.size(), 3);
    ASSERT_EQ(oneTour.tour[0], "W");
    ASSERT_EQ(oneTour.tour[1], "S1");
    ASSERT_EQ(oneTour.tour[2], "W");

    TwoOptResult oneOpt = TwoOpt::optimize(oneTour, oneMatrix);
    ASSERT_TRUE(oneOpt.success);
    ASSERT_NEAR(oneOpt.optimizedDistanceKm, 6.4, 1e-6);
    ASSERT_EQ(oneOpt.iterations, 0);

    // 3. Invalid inputs: Non-existent warehouse
    DistanceMatrix invalidWMatrix;
    bool badW = DistanceMatrix::build(g, "GHOST_WAREHOUSE", {"S1"}, invalidWMatrix, errMsg);
    ASSERT_FALSE(badW);
    ASSERT_TRUE(errMsg.find("Warehouse node does not exist") != std::string::npos);

    // 4. Invalid inputs: Non-existent stop
    DistanceMatrix invalidStopMatrix;
    bool badStop = DistanceMatrix::build(g, "W", {"NON_EXISTENT_STOP"}, invalidStopMatrix, errMsg);
    ASSERT_FALSE(badStop);
    ASSERT_TRUE(errMsg.find("Delivery stop node does not exist") != std::string::npos);

    // 5. Invalid inputs: Negative edge weight throws exception
    bool threwNegative = false;
    try {
        Graph negGraph;
        negGraph.addNode("X"); negGraph.addNode("Y");
        negGraph.addEdge("X", "Y", -5.0);
    } catch (const std::invalid_argument&) {
        threwNegative = true;
    }
    ASSERT_TRUE(threwNegative);

    // 6. Invalid inputs: Empty node ID throws exception
    bool threwEmpty = false;
    try {
        Graph emptyGraph;
        emptyGraph.addNode("");
    } catch (const std::invalid_argument&) {
        threwEmpty = true;
    }
    ASSERT_TRUE(threwEmpty);

    // 7. Invalid inputs: Duplicate node ID throws exception
    bool threwDup = false;
    try {
        Graph dupGraph;
        dupGraph.addNode("A");
        dupGraph.addNode("A");
    } catch (const std::invalid_argument&) {
        threwDup = true;
    }
    ASSERT_TRUE(threwDup);
}

// =============================================================================
// Test Suite 7: Brute-Force TSP Optimal Comparison (Comparing Route Costs)
// =============================================================================
void testBruteForceOptimalComparison() {
    std::cout << "[RUN] testBruteForceOptimalComparison...\n";

    // Construct a 5-stop city delivery instance (Warehouse + 5 customers = 6 total points)
    // 5! = 120 customer permutations for brute-force ground truth.
    Graph g;
    g.addNode("W", "Depot", 0, 0);
    g.addNode("A", "Stop A", 1, 0);
    g.addNode("B", "Stop B", 2, 2);
    g.addNode("C", "Stop C", 0, 3);
    g.addNode("D", "Stop D", -2, 2);
    g.addNode("E", "Stop E", -1, 0);

    // Fully connect with realistic planar distance weights
    auto addDist = [&](const std::string& u, const std::string& v, double d) {
        g.addEdge(u, v, d);
    };

    addDist("W", "A", 1.0);
    addDist("A", "B", 2.2);
    addDist("B", "C", 2.2);
    addDist("C", "D", 2.2);
    addDist("D", "E", 2.2);
    addDist("E", "W", 1.0);

    // Cross chords
    addDist("W", "C", 3.0);
    addDist("W", "B", 2.8);
    addDist("W", "D", 2.8);
    addDist("A", "C", 3.2);
    addDist("A", "D", 3.6);
    addDist("A", "E", 2.0);
    addDist("B", "D", 4.0);
    addDist("B", "E", 3.6);
    addDist("C", "E", 3.2);

    DistanceMatrix matrix;
    std::string errMsg;
    std::vector<std::string> stops = {"A", "B", "C", "D", "E"};
    bool built = DistanceMatrix::build(g, "W", stops, matrix, errMsg);
    ASSERT_TRUE(built);

    // 1. Compute exact global optimum via brute-force enumeration
    BruteForceTspResult bruteForce = solveBruteForceTSP(matrix);
    std::cout << "  -> Brute-force optimal tour cost: " << bruteForce.optimalCost << " km\n";

    // 2. Compute Nearest Neighbor heuristic tour
    TourResult nnRes = NearestNeighbor::solve(matrix);
    std::cout << "  -> Nearest Neighbor tour cost    : " << nnRes.totalDistanceKm << " km\n";

    // 3. Compute 2-Opt local search optimized tour
    TwoOptResult optRes = TwoOpt::optimize(nnRes, matrix);
    std::cout << "  -> 2-Opt optimized tour cost     : " << optRes.optimizedDistanceKm << " km\n";

    // Requirement (9) & (10): Compare route costs rather than exact visit sequences!
    // 2-Opt must not exceed the initial tour cost
    ASSERT_TRUE(optRes.optimizedDistanceKm <= nnRes.totalDistanceKm + 1e-9);

    // The 2-Opt cost should match or be within a very tight bound (<= 1.05x) of the brute-force optimum
    // On this small planar convex polygon, 2-Opt reaches the exact global minimum!
    ASSERT_NEAR(optRes.optimizedDistanceKm, bruteForce.optimalCost, 1e-6);

    std::cout << "  -> 2-Opt cost matches brute-force global optimum exactly ("
              << optRes.optimizedDistanceKm << " km == " << bruteForce.optimalCost << " km)!\n";
}

// =============================================================================
// Test Suite 8: Full Route Reconstruction (Leg Concatenation)
// =============================================================================
void testRouteUtilsExpansion() {
    std::cout << "[RUN] testRouteUtilsExpansion...\n";

    Graph g;
    g.addNode("W"); g.addNode("J1"); g.addNode("S1"); g.addNode("J2"); g.addNode("S2");
    g.addEdge("W", "J1", 1.0);
    g.addEdge("J1", "S1", 1.0);
    g.addEdge("S1", "J2", 1.0);
    g.addEdge("J2", "S2", 1.0);
    g.addEdge("S2", "W", 2.0);

    DistanceMatrix matrix;
    std::string errMsg;
    DistanceMatrix::build(g, "W", {"S1", "S2"}, matrix, errMsg);

    std::vector<std::string> tour = {"W", "S1", "S2", "W"};
    std::vector<std::string> fullPath = RouteUtils::expandToFullRoadPath(tour, matrix);

    // Leg W -> S1: W -> J1 -> S1
    // Leg S1 -> S2: S1 -> J2 -> S2
    // Leg S2 -> W: S2 -> W
    // Full merged path: W -> J1 -> S1 -> J2 -> S2 -> W (no consecutive duplicates)
    std::vector<std::string> expected = {"W", "J1", "S1", "J2", "S2", "W"};
    ASSERT_EQ(fullPath.size(), expected.size());
    for (size_t i = 0; i < expected.size(); ++i) {
        ASSERT_EQ(fullPath[i], expected[i]);
    }
}

// =============================================================================
// Test Suite 9: JSON Input/Output Interface End-to-End
// =============================================================================
void testJsonInterfaceEndToEnd() {
    std::cout << "[RUN] testJsonInterfaceEndToEnd...\n";

    // 1. Valid JSON payload
    std::string validJson = R"({
        "warehouse": "W",
        "stops": ["S1", "S2"],
        "nodes": [
            {"id": "W", "lat": 37.78, "lng": -122.40},
            {"id": "S1", "lat": 37.79, "lng": -122.41},
            {"id": "S2", "lat": 37.80, "lng": -122.39}
        ],
        "roads": [
            {"source": "W", "target": "S1", "distance_km": 1.5},
            {"source": "S1", "target": "S2", "distance_km": 2.0},
            {"source": "S2", "target": "W", "distance_km": 2.5}
        ]
    })";

    std::string responseStr = JsonInterface::processJson(validJson);
    std::string parseErr;
    SimpleJson::JsonValue res = SimpleJson::JsonValue::parse(responseStr, parseErr);

    ASSERT_TRUE(parseErr.empty());
    ASSERT_TRUE(res.isObject());
    ASSERT_TRUE(res["success"].asBool());
    ASSERT_TRUE(res.has("initialRoute"));
    ASSERT_TRUE(res.has("optimizedRoute"));
    ASSERT_TRUE(res.has("initialDistance"));
    ASSERT_TRUE(res.has("optimizedDistance"));
    ASSERT_TRUE(res.has("distanceSaved"));
    ASSERT_TRUE(res.has("improvementPercent"));
    ASSERT_TRUE(res.has("executionTimeMs"));
    ASSERT_TRUE(res.has("legs"));
    ASSERT_TRUE(res.has("fullRoadPath"));
    ASSERT_TRUE(res.has("fullCoordinates"));

    ASSERT_NEAR(res["initialDistance"].asDouble(), 6.0, 1e-6);
    ASSERT_NEAR(res["optimizedDistance"].asDouble(), 6.0, 1e-6);

    // 2. Malformed JSON payload
    std::string badJson = "{ invalid json here ";
    std::string badResponseStr = JsonInterface::processJson(badJson);
    SimpleJson::JsonValue badRes = SimpleJson::JsonValue::parse(badResponseStr, parseErr);
    ASSERT_TRUE(badRes.isObject());
    ASSERT_FALSE(badRes["success"].asBool());
    ASSERT_TRUE(badRes.has("error"));

    // 3. Unreachable stop payload
    std::string unreachableJson = R"({
        "warehouse": "W",
        "stops": ["S1", "ISLAND"],
        "nodes": [
            {"id": "W", "lat": 0, "lng": 0},
            {"id": "S1", "lat": 1, "lng": 1},
            {"id": "ISLAND", "lat": 5, "lng": 5}
        ],
        "roads": [
            {"source": "W", "target": "S1", "distance_km": 1.0}
        ]
    })";
    std::string unreachResponseStr = JsonInterface::processJson(unreachableJson);
    SimpleJson::JsonValue unreachRes = SimpleJson::JsonValue::parse(unreachResponseStr, parseErr);
    ASSERT_TRUE(unreachRes.isObject());
    ASSERT_FALSE(unreachRes["success"].asBool());
    ASSERT_TRUE(unreachRes["error"].asString().find("Unreachable") != std::string::npos);
}

// =============================================================================
// Helpers for randomized property tests
// =============================================================================
struct RandomInstance {
    Graph graph;
    std::vector<std::string> stops;
};

// Complete graph on random points in a 10 km x 10 km square with Euclidean road lengths.
RandomInstance makeRandomInstance(unsigned seed, int customers) {
    std::mt19937 rng(seed);
    std::uniform_real_distribution<double> coord(0.0, 10.0);

    RandomInstance inst;
    std::vector<std::string> ids;
    std::vector<std::pair<double, double>> points;
    for (int i = 0; i <= customers; ++i) {
        std::string id = (i == 0) ? "W" : "C" + std::to_string(i);
        double x = coord(rng);
        double y = coord(rng);
        inst.graph.addNode(id, id, y, x);
        ids.push_back(id);
        points.push_back({x, y});
        if (i > 0) inst.stops.push_back(id);
    }
    for (size_t i = 0; i < ids.size(); ++i) {
        for (size_t j = i + 1; j < ids.size(); ++j) {
            double dist = std::hypot(points[i].first - points[j].first, points[i].second - points[j].second);
            inst.graph.addEdge(ids[i], ids[j], dist);
        }
    }
    return inst;
}

DistanceMatrix buildMatrix(const RandomInstance& inst) {
    DistanceMatrix matrix;
    std::string err;
    DistanceMatrix::build(inst.graph, "W", inst.stops, matrix, err);
    return matrix;
}

// Closed tour [0, perm(1..m-1), 0] visiting every customer exactly once.
bool isValidClosedTour(const std::vector<int>& tour, size_t m) {
    if (tour.size() != m + 1 || tour.front() != 0 || tour.back() != 0) return false;
    std::vector<int> inner(tour.begin() + 1, tour.end() - 1);
    std::sort(inner.begin(), inner.end());
    for (size_t i = 0; i < inner.size(); ++i) {
        if (inner[i] != static_cast<int>(i + 1)) return false;
    }
    return true;
}

bool hasImproving2OptMove(const std::vector<int>& tour, const DistanceMatrix& matrix) {
    for (size_t i = 1; i + 2 < tour.size(); ++i) {
        for (size_t k = i + 1; k + 1 < tour.size(); ++k) {
            double delta = matrix.getDistance(tour[i - 1], tour[k]) + matrix.getDistance(tour[i], tour[k + 1])
                         - matrix.getDistance(tour[i - 1], tour[i]) - matrix.getDistance(tour[k], tour[k + 1]);
            if (delta < -1e-9) return true;
        }
    }
    return false;
}

SimpleJson::JsonValue runJson(const std::string& input, bool* ok = nullptr) {
    std::string err;
    return SimpleJson::JsonValue::parse(JsonInterface::processJson(input, ok), err);
}

// =============================================================================
// Test Suite 10: Held-Karp Exact DP Matches Brute Force
// =============================================================================
void testHeldKarpMatchesBruteForce() {
    std::cout << "[RUN] testHeldKarpMatchesBruteForce...\n";

    for (int customers = 0; customers <= 8; ++customers) {
        for (unsigned seed = 1; seed <= 3; ++seed) {
            DistanceMatrix matrix = buildMatrix(makeRandomInstance(seed * 100 + customers, customers));
            TourResult exact = HeldKarp::solve(matrix);
            BruteForceTspResult brute = solveBruteForceTSP(matrix);

            ASSERT_TRUE(exact.success);
            ASSERT_TRUE(isValidClosedTour(exact.tourIndices, matrix.size()));
            ASSERT_NEAR(exact.totalDistanceKm, brute.optimalCost, 1e-9);
            ASSERT_NEAR(TwoOpt::computeTourDistance(exact.tourIndices, matrix), exact.totalDistanceKm, 1e-9);
        }
    }

    // Above the limit the exact solver refuses instead of running for minutes.
    DistanceMatrix big = buildMatrix(makeRandomInstance(7, HeldKarp::kMaxStops + 1));
    TourResult skipped = HeldKarp::solve(big);
    ASSERT_FALSE(skipped.success);
    ASSERT_TRUE(skipped.errorMessage.find("exceeds") != std::string::npos);
}

// =============================================================================
// Test Suite 11: Full Pipeline Invariants on Random Instances
// NN >= 2-Opt >= 2-Opt+Or-opt >= exact optimum, and the final tour is a local optimum.
// =============================================================================
void testPipelineInvariantsRandom() {
    std::cout << "[RUN] testPipelineInvariantsRandom...\n";

    int reachedOptimum = 0;
    double totalGap = 0.0;
    const int trials = 30;

    for (unsigned seed = 1; seed <= static_cast<unsigned>(trials); ++seed) {
        RandomInstance inst = makeRandomInstance(seed, 12);
        OptimizationPipelineResult res = Optimizer::runPipeline(inst.graph, "W", inst.stops);
        ASSERT_TRUE(res.success);
        ASSERT_TRUE(res.exactTour.success);

        const double nn = res.nearestNeighborTour.totalDistanceKm;
        const double twoOpt = res.twoOptTour.optimizedDistanceKm;
        const double finalDist = res.optimizedTour.totalDistanceKm;
        const double exact = res.exactTour.totalDistanceKm;

        ASSERT_TRUE(twoOpt <= nn + 1e-9);
        ASSERT_TRUE(finalDist <= twoOpt + 1e-9);
        ASSERT_TRUE(finalDist >= exact - 1e-9);
        ASSERT_TRUE(isValidClosedTour(res.optimizedTour.tourIndices, res.matrix.size()));
        ASSERT_NEAR(TwoOpt::computeTourDistance(res.optimizedTour.tourIndices, res.matrix), finalDist, 1e-9);

        // Neither neighborhood can improve the returned tour any further.
        ASSERT_FALSE(hasImproving2OptMove(res.optimizedTour.tourIndices, res.matrix));
        std::vector<int> copy = res.optimizedTour.tourIndices;
        ASSERT_EQ(OrOpt::improve(copy, res.matrix), 0);

        if (finalDist <= exact + 1e-9) reachedOptimum++;
        totalGap += (finalDist - exact) / exact * 100.0;
    }

    std::cout << "  -> 2-Opt+Or-opt reached the exact optimum on " << reachedOptimum << "/" << trials
              << " random 12-stop instances (mean gap " << std::fixed << std::setprecision(3)
              << totalGap / trials << "%)\n" << std::defaultfloat;
}

// =============================================================================
// Test Suite 12: Local Search Operators on Bad Starting Tours
// =============================================================================
void testLocalSearchFromShuffledTours() {
    std::cout << "[RUN] testLocalSearchFromShuffledTours...\n";

    std::mt19937 rng(42);
    for (unsigned seed = 1; seed <= 10; ++seed) {
        DistanceMatrix matrix = buildMatrix(makeRandomInstance(seed, 30));
        std::vector<int> tour(matrix.size() - 1);
        std::iota(tour.begin(), tour.end(), 1);
        std::shuffle(tour.begin(), tour.end(), rng);
        tour.insert(tour.begin(), 0);
        tour.push_back(0);

        const double before = TwoOpt::computeTourDistance(tour, matrix);

        std::vector<int> orTour = tour;
        ASSERT_TRUE(OrOpt::improve(orTour, matrix) > 0);
        ASSERT_TRUE(isValidClosedTour(orTour, matrix.size()));
        ASSERT_TRUE(TwoOpt::computeTourDistance(orTour, matrix) < before);
        ASSERT_EQ(OrOpt::improve(orTour, matrix), 0);

        std::vector<int> twoTour = tour;
        ASSERT_TRUE(TwoOpt::improve(twoTour, matrix) > 0);
        ASSERT_TRUE(isValidClosedTour(twoTour, matrix.size()));
        ASSERT_TRUE(TwoOpt::computeTourDistance(twoTour, matrix) < before);
        ASSERT_FALSE(hasImproving2OptMove(twoTour, matrix));
    }
}

// =============================================================================
// Test Suite 13: On-Demand Road Path Reconstruction & Edge Validation
// =============================================================================
void testRoadPathsAndEdgeValidation() {
    std::cout << "[RUN] testRoadPathsAndEdgeValidation...\n";

    Graph g;
    g.addNode("W"); g.addNode("J1"); g.addNode("S1");
    g.addEdge("W", "J1", 1.0);
    g.addEdge("J1", "S1", 1.0);

    DistanceMatrix matrix;
    std::string errMsg;
    ASSERT_TRUE(DistanceMatrix::build(g, "W", {"S1"}, matrix, errMsg));

    std::vector<std::string> self = matrix.getRoadPath("W", "W");
    ASSERT_EQ(self.size(), 1);
    ASSERT_EQ(self[0], "W");

    std::vector<std::string> back = matrix.getRoadPath("S1", "W");
    std::vector<std::string> expected = {"S1", "J1", "W"};
    ASSERT_TRUE(back == expected);
    ASSERT_TRUE(matrix.getRoadPath(-1, 0).empty());
    ASSERT_TRUE(matrix.getRoadPath("W", "GHOST").empty());

    for (double bad : {std::numeric_limits<double>::infinity(), std::numeric_limits<double>::quiet_NaN(), -0.5}) {
        bool threw = false;
        try {
            g.addEdge("W", "S1", bad);
        } catch (const std::invalid_argument&) {
            threw = true;
        }
        ASSERT_TRUE(threw);
    }
}

// =============================================================================
// Test Suite 14: Strict Request Schema
// =============================================================================
void testStrictJsonSchema() {
    std::cout << "[RUN] testStrictJsonSchema...\n";

    const std::string nodes = R"("nodes": [{"id": "W"}, {"id": "S1"}])";
    auto request = [&](const std::string& top, const std::string& road) {
        return "{" + top + ", " + nodes + R"(, "roads": [)" + road + "]}";
    };
    const std::string goodTop = R"("warehouse": "W", "stops": ["S1"])";
    const std::string goodRoad = R"({"source": "W", "target": "S1", "distance_km": 2.0})";

    bool ok = false;
    SimpleJson::JsonValue res = runJson(request(goodTop, goodRoad), &ok);
    ASSERT_TRUE(ok);
    ASSERT_TRUE(res["success"].asBool());
    ASSERT_NEAR(res["optimizedDistance"].asDouble(), 4.0, 1e-9);

    // Missing distance must not become a free 0 km road.
    res = runJson(request(goodTop, R"({"source": "W", "target": "S1"})"), &ok);
    ASSERT_FALSE(ok);
    ASSERT_TRUE(res["error"].asString().find("distance_km") != std::string::npos);

    // Legacy aliases are rejected.
    res = runJson(request(goodTop, R"({"source": "W", "target": "S1", "distanceKm": 2.0})"));
    ASSERT_FALSE(res["success"].asBool());
    res = runJson(request(R"("warehouseId": "W", "stops": ["S1"])", goodRoad));
    ASSERT_TRUE(res["error"].asString().find("'warehouse'") != std::string::npos);
    res = runJson(request(R"("warehouse": "W", "deliveryStops": ["S1"])", goodRoad));
    ASSERT_TRUE(res["error"].asString().find("'stops'") != std::string::npos);
    res = runJson(request(R"("warehouse": "W", "stops": [{"id": "S1"}])", goodRoad));
    ASSERT_TRUE(res["error"].asString().find("Stop at index 0") != std::string::npos);

    // Numbers outside double range are an error, not a crash.
    res = runJson(request(goodTop, R"({"source": "W", "target": "S1", "distance_km": 1e999})"));
    ASSERT_TRUE(res["error"].asString().find("out of range") != std::string::npos);
}

// =============================================================================
// Test Suite 15: JSON Parser Robustness & Optimal Fields in the Response
// =============================================================================
void testJsonParserAndOptimalFields() {
    std::cout << "[RUN] testJsonParserAndOptimalFields...\n";

    std::string err;
    SimpleJson::JsonValue::parse("-", err);
    ASSERT_FALSE(err.empty());

    SimpleJson::JsonValue::parse(std::string(10000, '[') + std::string(10000, ']'), err);
    ASSERT_TRUE(err.find("nesting") != std::string::npos);

    // Built with char(92) so the source holds escape sequences, not decoded characters.
    const std::string bs(1, char(92));
    const std::string escaped = "\"caf" + bs + "u00e9 " + bs + "ud83d" + bs + "ude9a\"";
    SimpleJson::JsonValue text = SimpleJson::JsonValue::parse(escaped, err);
    ASSERT_TRUE(err.empty());
    ASSERT_TRUE(text.asString() == "caf\xC3\xA9 \xF0\x9F\x9A\x9A");

    SimpleJson::JsonValue::parse(R"("\ud83d")", err);
    ASSERT_TRUE(err.find("surrogate") != std::string::npos);

    ASSERT_EQ(SimpleJson::JsonValue(std::numeric_limits<double>::infinity()).serialize(), "null");
    SimpleJson::JsonValue huge = SimpleJson::JsonValue::parse(SimpleJson::JsonValue(1e300).serialize(), err);
    ASSERT_NEAR(huge.asDouble() / 1e300, 1.0, 1e-9);

    // Small instance: exact optimum and gap are reported.
    SimpleJson::JsonValue small = runJson(R"({
        "warehouse": "W", "stops": ["A", "B", "C"],
        "nodes": [{"id": "W"}, {"id": "A"}, {"id": "B"}, {"id": "C"}],
        "roads": [
            {"source": "W", "target": "A", "distance_km": 1},
            {"source": "A", "target": "B", "distance_km": 1},
            {"source": "B", "target": "C", "distance_km": 1},
            {"source": "C", "target": "W", "distance_km": 1}
        ]})");
    ASSERT_TRUE(small["success"].asBool());
    ASSERT_NEAR(small["optimalDistance"].asDouble(), 4.0, 1e-9);
    ASSERT_NEAR(small["optimalityGapPercent"].asDouble(), 0.0, 1e-9);
    ASSERT_EQ(small["optimalLegs"].asArray().size(), 4);
    ASSERT_EQ(small["stages"].asArray().size(), 3);

    // Above HeldKarp::kMaxStops the optimal fields are null, the rest still works.
    std::ostringstream big;
    const int stops = HeldKarp::kMaxStops + 1;
    big << R"({"warehouse": "N0", "stops": [)";
    for (int i = 1; i <= stops; ++i) big << (i > 1 ? "," : "") << "\"N" << i << "\"";
    big << R"(], "nodes": [)";
    for (int i = 0; i <= stops; ++i) big << (i > 0 ? "," : "") << R"({"id": "N)" << i << "\"}";
    big << R"(], "roads": [)";
    for (int i = 0; i < stops; ++i) {
        big << (i > 0 ? "," : "") << R"({"source": "N)" << i << R"(", "target": "N)" << i + 1
            << R"(", "distance_km": 1})";
    }
    big << "]}";
    SimpleJson::JsonValue large = runJson(big.str());
    ASSERT_TRUE(large["success"].asBool());
    ASSERT_TRUE(large["optimalDistance"].isNull());
    ASSERT_TRUE(large["optimalRoute"].isNull());
    ASSERT_NEAR(large["optimizedDistance"].asDouble(), 2.0 * stops, 1e-9);
}

// =============================================================================
// Main Test Runner Entry Point
// =============================================================================
int main() {
    std::cout << "======================================================================\n";
    std::cout << "   SMART DELIVERY ROUTE OPTIMIZER — AUTOMATED TEST SUITE             \n";
    std::cout << "======================================================================\n";

    testDijkstraManuallyVerified();
    testUnreachableVertices();
    testNearestNeighborProperties();
    testTwoOptNeverIncreasesCost();
    testAlreadyOptimalRoutes();
    testSmallAndInvalidInputs();
    testBruteForceOptimalComparison();
    testRouteUtilsExpansion();
    testJsonInterfaceEndToEnd();
    testHeldKarpMatchesBruteForce();
    testPipelineInvariantsRandom();
    testLocalSearchFromShuffledTours();
    testRoadPathsAndEdgeValidation();
    testStrictJsonSchema();
    testJsonParserAndOptimalFields();

    std::cout << "======================================================================\n";
    std::cout << "TEST RESULTS SUMMARY:\n";
    std::cout << "  - Total Assertions Checked: " << gTotalTests << "\n";
    std::cout << "  - Assertions Passed       : " << gPassedTests << "\n";
    std::cout << "  - Assertions Failed       : " << gFailedTests << "\n";
    std::cout << "======================================================================\n";

    if (gFailedTests > 0) {
        std::cerr << ">>> TEST RUN FAILED (" << gFailedTests << " failures)\n";
        return 1;
    }

    std::cout << ">>> ALL TESTS PASSED SUCCESSFULLY! (100% Success Rate)\n";
    return 0;
}
