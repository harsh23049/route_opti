#include "Graph.h"

namespace DeliveryOptimizer {

int Graph::addNode(const std::string& id,
                   const std::string& name,
                   double lat,
                   double lng) {
    if (id.empty()) {
        throw std::invalid_argument("Node ID cannot be empty");
    }
    if (idToIndex_.find(id) != idToIndex_.end()) {
        throw std::invalid_argument("Duplicate node ID: " + id);
    }

    int newIndex = static_cast<int>(nodes_.size());
    Node node;
    node.index = newIndex;
    node.id = id;
    node.name = name.empty() ? id : name;
    node.lat = lat;
    node.lng = lng;

    nodes_.push_back(node);
    idToIndex_[id] = newIndex;
    adjList_.emplace_back(); // empty edge list for new node

    return newIndex;
}

void Graph::addEdge(const std::string& uId,
                    const std::string& vId,
                    double distanceKm,
                    const std::string& streetName) {
    // Requirement (1): Non-negative edge distances
    if (distanceKm < 0.0) {
        throw std::invalid_argument("Edge distance cannot be negative: " + std::to_string(distanceKm));
    }

    auto itU = idToIndex_.find(uId);
    if (itU == idToIndex_.end()) {
        throw std::invalid_argument("Source node does not exist: " + uId);
    }

    auto itV = idToIndex_.find(vId);
    if (itV == idToIndex_.end()) {
        throw std::invalid_argument("Destination node does not exist: " + vId);
    }

    int uIdx = itU->second;
    int vIdx = itV->second;

    // Requirement (1) & (2): Weighted undirected graph stored in adjacency list
    Edge forwardEdge;
    forwardEdge.targetIndex = vIdx;
    forwardEdge.targetId = vId;
    forwardEdge.distanceKm = distanceKm;
    forwardEdge.streetName = streetName;
    adjList_[uIdx].push_back(forwardEdge);

    // Symmetric reverse edge (for undirected road network)
    Edge backwardEdge;
    backwardEdge.targetIndex = uIdx;
    backwardEdge.targetId = uId;
    backwardEdge.distanceKm = distanceKm;
    backwardEdge.streetName = streetName;
    adjList_[vIdx].push_back(backwardEdge);

    undirectedEdgeCount_++;
}

bool Graph::hasNode(const std::string& id) const {
    return idToIndex_.find(id) != idToIndex_.end();
}

int Graph::getNodeIndex(const std::string& id) const {
    auto it = idToIndex_.find(id);
    if (it != idToIndex_.end()) {
        return it->second;
    }
    return -1;
}

const std::string& Graph::getNodeId(int index) const {
    static const std::string emptyId = "";
    if (index >= 0 && index < static_cast<int>(nodes_.size())) {
        return nodes_[index].id;
    }
    return emptyId;
}

const Node* Graph::getNode(const std::string& id) const {
    auto it = idToIndex_.find(id);
    if (it != idToIndex_.end()) {
        return &nodes_[it->second];
    }
    return nullptr;
}

const Node* Graph::getNodeByIndex(int index) const {
    if (index >= 0 && index < static_cast<int>(nodes_.size())) {
        return &nodes_[index];
    }
    return nullptr;
}

const std::vector<Edge>& Graph::getNeighbors(int nodeIndex) const {
    static const std::vector<Edge> emptyList;
    if (nodeIndex >= 0 && nodeIndex < static_cast<int>(adjList_.size())) {
        return adjList_[nodeIndex];
    }
    return emptyList;
}

const std::vector<Edge>& Graph::getNeighbors(const std::string& id) const {
    int idx = getNodeIndex(id);
    return getNeighbors(idx);
}

size_t Graph::getNodeCount() const {
    return nodes_.size();
}

size_t Graph::getEdgeCount() const {
    return undirectedEdgeCount_;
}

const std::vector<Node>& Graph::getAllNodes() const {
    return nodes_;
}

void Graph::clear() {
    nodes_.clear();
    idToIndex_.clear();
    adjList_.clear();
    undirectedEdgeCount_ = 0;
}

} // namespace DeliveryOptimizer
