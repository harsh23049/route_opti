#ifndef JSON_INTERFACE_H
#define JSON_INTERFACE_H

#include "Json.h"
#include <string>

namespace DeliveryOptimizer {

class JsonInterface {
public:
    /**
     * Processes a JSON input string, runs graph construction, Dijkstra,
     * Nearest Neighbor, and 2-Opt, and returns a formatted JSON response string.
     * Diagnostic logs and errors are emitted to std::cerr.
     */
    static std::string processJson(const std::string& inputJson);
};

} // namespace DeliveryOptimizer

#endif // JSON_INTERFACE_H
