# Smart Delivery Route Optimization

A college Algorithms mini-project demonstrating graph traversal and route optimization algorithms for simulated urban parcel delivery.

## Tech Stack
- **Core Algorithms Engine:** C++ (C++17) built with CMake
- **API Integration:** Node.js + Express
- **Frontend Application:** React + Vite + Tailwind CSS
- **Map Visualization:** Native SVG simulated city road network (no external map APIs)
- **Architecture Constraints:** Self-contained, zero external databases, zero authentication, zero cloud map dependencies, pure algorithmic logic.

---

## Monorepo Structure

```
route_opti/
├── algorithms/     # C++ optimization engine (CMake build)
│   ├── include/    # C++ header files
│   ├── src/        # C++ source files
│   └── CMakeLists.txt
├── backend/        # Express API server (bridge to C++ engine)
│   ├── src/        # Express app and route handlers
│   └── package.json
├── frontend/       # React + Vite + Tailwind CSS user interface
│   ├── src/        # React components, styles, and entry points
│   ├── index.html
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── package.json
├── data/           # City graph and sample delivery datasets (JSON)
├── docs/           # Project specifications and architecture documentation
├── .gitignore
└── README.md
```

---

## Prerequisites
- **C++ Compiler:** Clang++ or G++ supporting C++17
- **CMake:** Version 3.14 or higher
- **Node.js:** v18+ (tested on Node v26)
- **npm:** v9+

---

## Getting Started & Commands

### 1. Build and Run C++ Algorithm Engine
```bash
# Navigate to algorithms directory
cd algorithms

# Configure and build using CMake
cmake -B build -S .
cmake --build build

# Execute the engine
./build/optimizer_engine
```

### 2. Run Backend API Server
```bash
# Navigate to backend directory
cd backend

# Install minimal dependencies
npm install

# Start Express server (runs on port 5001)
npm start
```

### 3. Run Frontend Development Server
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Vite dev server (runs on http://localhost:3000)
npm run dev

# Or build for production preview
npm run build
```
