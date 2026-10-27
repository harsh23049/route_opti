#ifndef JSON_INTERFACE_H
#define JSON_INTERFACE_H

#include "Json.h"
#include <string>

namespace DeliveryOptimizer {

class JsonInterface {
public:
    /**
     * Processes a JSON input string, runs graph construction, Dijkstra, Nearest Neighbor,
     * 2-Opt, Or-opt, (for small inputs) Held-Karp and, with "vehicles" > 1, the multi-van split,
     * and returns a formatted JSON response.
     * Diagnostic logs and errors are emitted to std::cerr.
     * When `ok` is given, it is set to whether the response has "success": true.
     */
    static std::string processJson(const std::string& inputJson, bool* ok = nullptr);

    /** Serializes {"success": false, "error": message} and logs the message to std::cerr. */
    static std::string errorJson(const std::string& message);
};

} // namespace DeliveryOptimizer

#endif // JSON_INTERFACE_H
