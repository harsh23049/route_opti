cmake_minimum_required(VERSION 3.16)
project(SmartDeliveryOptimizer VERSION 2.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Single-config generators (Makefiles, Ninja) default to an optimized build.
if(NOT CMAKE_CONFIGURATION_TYPES AND NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type" FORCE)
endif()

option(ROUTE_OPTI_WERROR "Treat compiler warnings as errors" OFF)
option(ROUTE_OPTI_SANITIZE "Build with AddressSanitizer + UndefinedBehaviorSanitizer (GCC/Clang)" OFF)

# The generator expression stops multi-config generators (Visual Studio) from appending
# a per-config subdirectory, so the backend always finds build/optimizer_engine[.exe].
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY "$<1:${CMAKE_BINARY_DIR}>")

# Core algorithm library
add_library(optimizer_core STATIC
    src/Graph.cpp
    src/Dijkstra.cpp
    src/DistanceMatrix.cpp
    src/NearestNeighbor.cpp
    src/TwoOpt.cpp
    src/OrOpt.cpp
    src/HeldKarp.cpp
    src/Fleet.cpp
    src/RouteUtils.cpp
    src/Optimizer.cpp
    src/Json.cpp
    src/JsonInterface.cpp
)
target_include_directories(optimizer_core PUBLIC include)

# Warning and sanitizer flags are PUBLIC so the engine and tests build the same way.
if(MSVC)
    target_compile_options(optimizer_core PUBLIC /W4 /permissive- /utf-8)
    if(ROUTE_OPTI_WERROR)
        target_compile_options(optimizer_core PUBLIC /WX)
    endif()
else()
    target_compile_options(optimizer_core PUBLIC -Wall -Wextra -Wpedantic)
    if(ROUTE_OPTI_WERROR)
        target_compile_options(optimizer_core PUBLIC -Werror)
    endif()
    if(ROUTE_OPTI_SANITIZE)
        target_compile_options(optimizer_core PUBLIC -fsanitize=address,undefined -fno-omit-frame-pointer -fno-sanitize-recover=all)
        target_link_options(optimizer_core PUBLIC -fsanitize=address,undefined)
    endif()
endif()

# Engine CLI executable (spawned by the backend)
add_executable(optimizer_engine src/main.cpp)
target_link_libraries(optimizer_engine PRIVATE optimizer_core)

# Tests (run with: ctest --test-dir build -C Release --output-on-failure)
enable_testing()
add_executable(test_runner tests/test_algorithms.cpp)
target_link_libraries(test_runner PRIVATE optimizer_core)
add_test(NAME algorithm_unit_tests COMMAND test_runner)

add_test(NAME engine_cli_sample_input
         COMMAND optimizer_engine --file ${CMAKE_CURRENT_SOURCE_DIR}/../data/sample-input.json)
add_test(NAME engine_cli_missing_file_fails
         COMMAND optimizer_engine --file ${CMAKE_CURRENT_BINARY_DIR}/does-not-exist.json)
set_tests_properties(engine_cli_missing_file_fails PROPERTIES WILL_FAIL TRUE)
