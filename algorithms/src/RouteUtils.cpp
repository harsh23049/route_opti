#include "RouteUtils.h"

namespace DeliveryOptimizer {

std::vector<std::string> RouteUtils::expandToFullRoadPath(const std::vector<std::string>& tour,
                                                         const DistanceMatrix& matrix) {
    std::vector<std::string> fullPath;
    if (tour.size() < 2) return fullPath;

    for (size_t i = 0; i < tour.size() - 1; ++i) {
        const std::string& from = tour[i];
        const std::string& to = tour[i + 1];

        const std::vector<std::string>& legPath = matrix.getRoadPath(from, to);
        if (legPath.empty()) continue;

        size_t startOffset = (i == 0) ? 0 : 1; // Avoid duplicate node at leg transitions
        for (size_t j = startOffset; j < legPath.size(); ++j) {
            fullPath.push_back(legPath[j]);
        }
    }

    return fullPath;
}

} // namespace DeliveryOptimizer
