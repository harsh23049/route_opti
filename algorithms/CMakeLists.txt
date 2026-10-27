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
    src/Optimizer.cpp
)

# Static library for core algorithms
add_library(optimizer_core STATIC ${SOURCES})

# Main engine CLI executable
add_executable(optimizer_engine src/main.cpp)
target_link_libraries(optimizer_engine PRIVATE optimizer_core)
