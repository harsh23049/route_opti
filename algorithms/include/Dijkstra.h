#ifndef DIJKSTRA_H
#define DIJKSTRA_H

#include "Graph.h"
#include <string>
#include <vector>
#include <limits>

namespace DeliveryOptimizer {

/**
 * Result of a point-to-point shortest path computation.
 */
struct DijkstraResult {
    bool reachable{false};
    std::string startId;
    std::string targetId;
    double distanceKm{std::numeric_limits<double>::infinity()};
    std::vector<std::string> pathNodes; // Reconstructed node sequence [startId, ..., targetId]
    std::vector<std::string> streetNames; // Turn-by-turn road names
    double executionTimeMicroseconds{0.0};
};

/**
 * Internal single-source Dijkstra results containing distances and predecessor trees
 * for fast path reconstruction to multiple targets.
 */
struct SingleSourceResult {
    int sourceIndex{-1};
    std::vector<double> distances;
    std::vector<int> parents;
    std::vector<std::string> parentEdgeStreet;

    bool isReachable(int targetIndex) const {
        return targetIndex >= 0 && targetIndex < static_cast<int>(distances.size()) &&
               distances[targetIndex] < (std::numeric_limits<double>::infinity() / 2.0);
    }

    std::vector<int> reconstructIndexNodes(int targetIndex) const;
    std::vector<std::string> reconstructPathNodes(const Graph& graph, int targetIndex) const;
    std::vector<std::string> reconstructStreetNames(int targetIndex) const;
};

/**
 * Dijkstra Shortest Path Algorithm
 * 
 * Logic:
 * Uses a min-priority queue (min-heap) to greedily expand the closest unvisited node.
 * Maintains an array of tentative distances and parent pointers for path reconstruction.
 * 
 * Time Complexity:
 * - With min-priority queue and adjacency list: O((V + E) log V)
 *   where V is the number of road intersections and E is the number of road segments.
 * 
 * Space Complexity:
 * - O(V) for distances array, parent pointers, visited states, and priority queue elements.
 */
class Dijkstra {
public:
    /**
     * Computes single-source shortest paths from startNode to all nodes in the graph.
     */
    static SingleSourceResult computeFromSource(const Graph& graph, int sourceIndex);

    /**
     * Convenience method computing single-source shortest paths using string ID.
     */
    static SingleSourceResult computeFromSource(const Graph& graph, const std::string& sourceId);

    /**
     * Finds the shortest path between startId and targetId and reconstructs the road path.
     * Returns DijkstraResult with reachable=false if either node is invalid or unreachable.
     */
    static DijkstraResult findShortestPath(const Graph& graph,
                                          const std::string& startId,
                                          const std::string& targetId);
};

} // namespace DeliveryOptimizer

#endif // DIJKSTRA_H
