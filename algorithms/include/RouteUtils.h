#ifndef ROUTE_UTILS_H
#define ROUTE_UTILS_H

#include "DistanceMatrix.h"
#include <vector>
#include <string>

namespace DeliveryOptimizer {

class RouteUtils {
public:
    /**
     * Expands a stop sequence [W, S1, S2, ..., W] into full turn-by-turn road network nodes
     * by concatenating the Dijkstra shortest paths for each leg, omitting consecutive duplicate junctions.
     */
    static std::vector<std::string> expandToFullRoadPath(const std::vector<std::string>& tour,
                                                         const DistanceMatrix& matrix);
};

} // namespace DeliveryOptimizer

#endif // ROUTE_UTILS_H
