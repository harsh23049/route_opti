cmake_minimum_required(VERSION 3.14)
project(SmartDeliveryOptimizer CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Standard compiler warnings and optimization
if(MSVC)
    add_compile_options(/W4 /O2)
else()
    add_compile_options(-Wall -Wextra -O2 -pedantic)
endif()

# Header include paths
include_directories(include)

# Core algorithm source files
set(SOURCES
    src/Graph.cpp
    src/Dijkstra.cpp
    src/DistanceMatrix.cpp
    src/NearestNeighbor.cpp
    src/TwoOpt.cpp
    src/RouteUtils.cpp
    src/Optimizer.cpp
    src/Json.cpp
    src/JsonInterface.cpp
)

# Static library for core algorithms
add_library(optimizer_core STATIC ${SOURCES})

# Main engine CLI executable
add_executable(optimizer_engine src/main.cpp)
target_link_libraries(optimizer_engine PRIVATE optimizer_core)

# Automated Testing with CTest
enable_testing()
add_executable(test_runner tests/test_algorithms.cpp)
target_link_libraries(test_runner PRIVATE optimizer_core)
add_test(NAME AlgorithmEngineTests COMMAND test_runner)
