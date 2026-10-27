#include "Graph.h"
#include "Dijkstra.h"
#include "DistanceMatrix.h"
#include "NearestNeighbor.h"
#include "TwoOpt.h"
#include "RouteUtils.h"
#include "Optimizer.h"
#include "JsonInterface.h"

#include <iostream>
#include <fstream>
#include <sstream>
#include <iomanip>
#include <string>
#include <vector>
#include <unistd.h>

using namespace DeliveryOptimizer;

void printDemo();

int main(int argc, char* argv[]) {
    // 1. Check for explicit --demo flag
    if (argc > 1 && std::string(argv[1]) == "--demo") {
        printDemo();
        return 0;
    }

    std::string jsonInput;

    // 2. Check for --file <filepath> argument
    if (argc >= 3 && std::string(argv[1]) == "--file") {
        std::ifstream file(argv[2]);
        if (!file.is_open()) {
            std::cerr << "[Error] Cannot open input file: " << argv[2] << "\n";
            std::cout << "{\n  \"success\": false,\n  \"error\": \"Cannot open input file: "
                      << argv[2] << "\"\n}\n";
            return 1;
        }
        std::stringstream buffer;
        buffer << file.rdbuf();
        jsonInput = buffer.str();
    } else {
        // 3. Read from standard input (pipe, redirect, or stdin flag)
        // If interactive terminal with no piped data and no args, run demo
        if (isatty(fileno(stdin)) && argc == 1) {
            std::cerr << "[Notice] No piped input detected. Running built-in demonstration.\n";
            std::cerr << "[Notice] To supply JSON, use: ./optimizer_engine --file input.json OR pipe via stdin.\n\n";
            printDemo();
            return 0;
        }

        std::stringstream buffer;
        buffer << std::cin.rdbuf();
        jsonInput = buffer.str();
    }

    if (jsonInput.empty()) {
        std::cerr << "[Error] Empty input payload received.\n";
        std::cout << "{\n  \"success\": false,\n  \"error\": \"Empty input payload received\"\n}\n";
        return 1;
    }

    // Process JSON input and write strictly valid JSON to stdout
    std::string jsonOutput = JsonInterface::processJson(jsonInput);
    std::cout << jsonOutput << "\n";

    return 0;
}

// Built-in demonstration run when executed with --demo or in terminal with no stdin
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
    if (res.success) {
        std::cout << "Pipeline Executed Successfully:\n";
        std::cout << "  - Initial Tour (NN)    : ";
        for (const auto& s : res.nearestNeighborTour.tour) std::cout << s << " ";
        std::cout << " (" << res.nearestNeighborTour.totalDistanceKm << " km)\n";

        std::cout << "  - Optimized Tour (2-Opt): ";
        for (const auto& s : res.twoOptTour.optimizedTour) std::cout << s << " ";
        std::cout << " (" << res.twoOptTour.optimizedDistanceKm << " km)\n";

        std::cout << "  - Distance Saved       : " << res.twoOptTour.distanceSavedKm << " km (-"
                  << res.twoOptTour.percentageImprovement << "%)\n";
        std::cout << "  - Total Compute Time   : " << res.totalPipelineExecutionTimeMicroseconds << " microseconds\n";
    }
}
