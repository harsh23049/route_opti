#include "Dijkstra.h"
#include <queue>
#include <algorithm>
#include <chrono>

namespace DeliveryOptimizer {

std::vector<int> SingleSourceResult::reconstructIndexNodes(int targetIndex) const {
    std::vector<int> path;
    if (targetIndex < 0 || targetIndex >= static_cast<int>(distances.size()) || !isReachable(targetIndex)) {
        return path;
    }

    int curr = targetIndex;
    while (curr != -1) {
        path.push_back(curr);
        if (curr == sourceIndex) break;
        curr = parents[curr];
    }
    std::reverse(path.begin(), path.end());
    return path;
}

std::vector<std::string> SingleSourceResult::reconstructPathNodes(const Graph& graph, int targetIndex) const {
    std::vector<int> indexNodes = reconstructIndexNodes(targetIndex);
    std::vector<std::string> idPath;
    idPath.reserve(indexNodes.size());
    for (int idx : indexNodes) {
        idPath.push_back(graph.getNodeId(idx));
    }
    return idPath;
}

std::vector<std::string> SingleSourceResult::reconstructStreetNames(int targetIndex) const {
    std::vector<std::string> streets;
    if (targetIndex < 0 || targetIndex >= static_cast<int>(distances.size()) || !isReachable(targetIndex)) {
        return streets;
    }

    int curr = targetIndex;
    while (curr != -1 && curr != sourceIndex) {
        if (!parentEdgeStreet[curr].empty()) {
            streets.push_back(parentEdgeStreet[curr]);
        }
        curr = parents[curr];
    }
    std::reverse(streets.begin(), streets.end());
    return streets;
}

SingleSourceResult Dijkstra::computeFromSource(const Graph& graph, int sourceIndex) {
    size_t numNodes = graph.getNodeCount();
    SingleSourceResult res;
    res.sourceIndex = sourceIndex;

    if (sourceIndex < 0 || sourceIndex >= static_cast<int>(numNodes)) {
        return res;
    }

    res.distances.assign(numNodes, std::numeric_limits<double>::infinity());
    res.parents.assign(numNodes, -1);
    res.parentEdgeStreet.assign(numNodes, "");

    // Min-priority queue: stores (current_tentative_distance, node_index)
    // std::greater orders smaller distances to the top of the heap.
    using PqElement = std::pair<double, int>;
    std::priority_queue<PqElement, std::vector<PqElement>, std::greater<PqElement>> pq;

    std::vector<bool> visited(numNodes, false);

    // Initialize source
    res.distances[sourceIndex] = 0.0;
    pq.push({0.0, sourceIndex});

    while (!pq.empty()) {
        auto [currentDist, u] = pq.top();
        pq.pop();

        if (visited[u]) {
            continue;
        }
        visited[u] = true;

        // Traverse all adjacent outgoing edges from node u
        for (const Edge& edge : graph.getNeighbors(u)) {
            int v = edge.targetIndex;
            double weight = edge.distanceKm;

            // Relaxation step: check if path via u offers a shorter road distance to v
            if (!visited[v] && currentDist + weight < res.distances[v]) {
                res.distances[v] = currentDist + weight;
                res.parents[v] = u;
                res.parentEdgeStreet[v] = edge.streetName;
                pq.push({res.distances[v], v});
            }
        }
    }

    return res;
}

SingleSourceResult Dijkstra::computeFromSource(const Graph& graph, const std::string& sourceId) {
    int idx = graph.getNodeIndex(sourceId);
    return computeFromSource(graph, idx);
}

DijkstraResult Dijkstra::findShortestPath(const Graph& graph,
                                          const std::string& startId,
                                          const std::string& targetId) {
    auto startTime = std::chrono::high_resolution_clock::now();

    DijkstraResult result;
    result.startId = startId;
    result.targetId = targetId;

    int startIdx = graph.getNodeIndex(startId);
    int targetIdx = graph.getNodeIndex(targetId);

    // Validate node existence
    if (startIdx == -1 || targetIdx == -1) {
        result.reachable = false;
        return result;
    }

    // Trivial case: source is same as target
    if (startIdx == targetIdx) {
        result.reachable = true;
        result.distanceKm = 0.0;
        result.pathNodes = {startId};
        auto endTime = std::chrono::high_resolution_clock::now();
        result.executionTimeMicroseconds =
            std::chrono::duration<double, std::micro>(endTime - startTime).count();
        return result;
    }

    SingleSourceResult ssr = computeFromSource(graph, startIdx);

    if (ssr.isReachable(targetIdx)) {
        result.reachable = true;
        result.distanceKm = ssr.distances[targetIdx];
        result.pathNodes = ssr.reconstructPathNodes(graph, targetIdx);
        result.streetNames = ssr.reconstructStreetNames(targetIdx);
    } else {
        result.reachable = false;
        result.distanceKm = std::numeric_limits<double>::infinity();
    }

    auto endTime = std::chrono::high_resolution_clock::now();
    result.executionTimeMicroseconds =
        std::chrono::duration<double, std::micro>(endTime - startTime).count();

    return result;
}

} // namespace DeliveryOptimizer
