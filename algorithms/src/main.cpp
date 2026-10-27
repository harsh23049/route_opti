#include "Optimizer.h"
#include "JsonInterface.h"

#include <iostream>
#include <fstream>
#include <sstream>
#include <iomanip>
#include <string>
#include <vector>

using namespace DeliveryOptimizer;

namespace {

void printUsage() {
    std::cerr << "Usage:\n"
              << "  optimizer_engine < input.json        Read request JSON from stdin\n"
              << "  optimizer_engine --file input.json   Read request JSON from a file\n"
              << "  optimizer_engine --demo              Run the built-in demonstration\n"
              << "  optimizer_engine --version           Print the engine version\n";
}

void printTour(const char* label, const TourResult& tour) {
    std::cout << "  - " << std::left << std::setw(26) << label << ": ";
    for (const auto& s : tour.tour) std::cout << s << " ";
    std::cout << " (" << tour.totalDistanceKm << " km)\n";
}

// Built-in demonstration run with --demo
void printDemo() {
    std::cout << std::fixed << std::setprecision(3);
    std::cout << "======================================================================\n";
    std::cout << "  SMART DELIVERY ROUTE OPTIMIZATION — CORE ALGORITHM ENGINE\n";
    std::cout << "  Version: " << Optimizer::getEngineVersion() << " | Standard: C++17\n";
    std::cout << "======================================================================\n\n";

    Graph cityGraph;
    cityGraph.addNode("W",  "Central Warehouse",      37.7830, -122.4080);
    cityGraph.addNode("S1", "North-West Delivery",    37.7915, -122.4150);
    cityGraph.addNode("S2", "North-Central Delivery", 37.7940, -122.4050);
    cityGraph.addNode("S3", "North-East Delivery",    37.7910, -122.3960);
    cityGraph.addNode("S4", "East Delivery Depot",    37.7810, -122.3920);
    cityGraph.addNode("J1", "Central Junction",       37.7865, -122.4045);
    cityGraph.addNode("J2", "Crosstown Overpass",     37.7870, -122.4120);
    cityGraph.addNode("J3", "Eastside Crossroads",    37.7780, -122.4010);

    cityGraph.addEdge("W", "J1", 1.80, "Warehouse Connector Blvd");
    cityGraph.addEdge("W", "J2", 2.00, "Westbound Expressway");
    cityGraph.addEdge("W", "J3", 1.60, "South Arterial");
    cityGraph.addEdge("J2", "S1", 1.50, "Northwest Parkway");
    cityGraph.addEdge("J1", "S2", 0.80, "Central Spine Avenue");
    cityGraph.addEdge("S1", "S2", 1.20, "North Boulevard");
    cityGraph.addEdge("S2", "S3", 1.10, "Highland Way");
    cityGraph.addEdge("S3", "S4", 1.40, "Bayside Drive");
    cityGraph.addEdge("J3", "S4", 1.90, "South-East Highway");
    cityGraph.addEdge("J1", "J3", 1.40, "Midtown Link");
    cityGraph.addEdge("J1", "S3", 2.20, "Diagonal Parkway");
    cityGraph.addEdge("S4", "J2", 4.20, "Cross-City Tunnel");

    OptimizationPipelineResult res = Optimizer::runPipeline(cityGraph, "W", {"S1", "S2", "S3", "S4"});
    if (!res.success) {
        std::cout << "Pipeline failed: " << res.errorMessage << "\n";
        return;
    }

    std::cout << "Pipeline Executed Successfully:\n";
    printTour("Initial Tour (NN)", res.nearestNeighborTour);
    std::cout << "  - " << std::left << std::setw(26) << "After 2-Opt" << ": "
              << res.twoOptTour.optimizedDistanceKm << " km\n";
    printTour("Optimized (2-Opt+Or-opt)", res.optimizedTour);
    if (res.exactTour.success) printTour("Exact Optimum (Held-Karp)", res.exactTour);
    std::cout << "  - " << std::left << std::setw(26) << "Total Compute Time" << ": "
              << res.totalPipelineExecutionTimeMicroseconds << " microseconds\n";
}

} // namespace

int main(int argc, char* argv[]) {
    const std::string mode = argc > 1 ? argv[1] : "";

    if (mode == "--demo") {
        printDemo();
        return 0;
    }
    if (mode == "--version") {
        std::cout << Optimizer::getEngineVersion() << "\n";
        return 0;
    }
    if (mode == "--help" || mode == "-h") {
        printUsage();
        return 0;
    }

    std::string jsonInput;
    if (mode == "--file" && argc == 3) {
        std::ifstream file(argv[2], std::ios::binary);
        if (!file.is_open()) {
            std::cout << JsonInterface::errorJson(std::string("Cannot open input file: ") + argv[2]) << "\n";
            return 1;
        }
        std::stringstream buffer;
        buffer << file.rdbuf();
        jsonInput = buffer.str();
    } else if (argc == 1) {
        // Read from standard input (pipe or redirect) — the IPC path used by the backend.
        std::stringstream buffer;
        buffer << std::cin.rdbuf();
        jsonInput = buffer.str();
    } else {
        printUsage();
        return 2;
    }

    if (jsonInput.empty()) {
        std::cout << JsonInterface::errorJson("Empty input payload received") << "\n";
        return 1;
    }

    // stdout carries exactly one JSON document; the exit code mirrors its "success" flag.
    bool ok = false;
    std::cout << JsonInterface::processJson(jsonInput, &ok) << "\n";
    return ok ? 0 : 1;
}
