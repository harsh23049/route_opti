#ifndef OPTIMIZER_H
#define OPTIMIZER_H

#include <string>
#include <vector>

namespace DeliveryOptimizer {

struct Node {
    std::string id;
    std::string name;
    double lat{0.0};
    double lng{0.0};
};

struct Edge {
    std::string source;
    std::string target;
    double distanceKm{0.0};
};

class Optimizer {
public:
    static std::string getEngineVersion();
    static void printEngineStatus();
};

} // namespace DeliveryOptimizer

#endif // OPTIMIZER_H
