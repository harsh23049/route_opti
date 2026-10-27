#ifndef GRAPH_H
#define GRAPH_H

#include <string>
#include <vector>
#include <unordered_map>
#include <stdexcept>
#include <limits>

namespace DeliveryOptimizer {

/**
 * Represents a node/intersection in the road network.
 */
struct Node {
    int index{-1};            // Internal 0-based contiguous index
    std::string id;           // Unique identifier (e.g., "W", "S1", "J1")
    std::string name;         // Human-readable location name
    double lat{0.0};          // Latitude (for spatial / map projection)
    double lng{0.0};          // Longitude (for spatial / map projection)
};

/**
 * Represents a directed half-edge in the adjacency list.
 */
struct Edge {
    int targetIndex{-1};       // Destination node internal index
    std::string targetId;      // Destination node string ID
    double distanceKm{0.0};    // Non-negative edge weight (road distance in km)
    std::string streetName;    // Name of the street / road segment
};

/**
 * Weighted undirected graph representing the city road network.
 * Uses an adjacency list: std::vector<std::vector<Edge>> indexed by internal node index.
 * Maps string node IDs to internal contiguous integer indices for O(1) lookups.
 * 
 * Invariants:
 * - Edge weights must be non-negative (distanceKm >= 0.0).
 * - For every edge (u, v) with weight w, there exists a symmetric edge (v, u) with weight w.
 */
class Graph {
public:
    Graph() = default;

    /**
     * Adds a node to the road network.
     * Throws std::invalid_argument if node ID is empty or already exists.
     */
    int addNode(const std::string& id,
                const std::string& name = "",
                double lat = 0.0,
                double lng = 0.0);

    /**
     * Adds an undirected weighted edge between node u and node v.
     * Adds u -> v and v -> u in the adjacency list with identical weight.
     * Throws std::invalid_argument if u or v do not exist, or if distanceKm < 0.
     */
    void addEdge(const std::string& uId,
                 const std::string& vId,
                 double distanceKm,
                 const std::string& streetName = "");

    // Query methods
    bool hasNode(const std::string& id) const;
    int getNodeIndex(const std::string& id) const;
    const std::string& getNodeId(int index) const;
    const Node* getNode(const std::string& id) const;
    const Node* getNodeByIndex(int index) const;

    const std::vector<Edge>& getNeighbors(int nodeIndex) const;
    const std::vector<Edge>& getNeighbors(const std::string& id) const;

    size_t getNodeCount() const;
    size_t getEdgeCount() const; // Undirected count (each bidirectional pair counts as 1)

    const std::vector<Node>& getAllNodes() const;

    void clear();

private:
    std::vector<Node> nodes_;
    std::unordered_map<std::string, int> idToIndex_;
    std::vector<std::vector<Edge>> adjList_;
    size_t undirectedEdgeCount_{0};
};

} // namespace DeliveryOptimizer

#endif // GRAPH_H
