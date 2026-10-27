const os = require('os');
const path = require('path');

const positiveInt = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

const engineFile = process.platform === 'win32' ? 'optimizer_engine.exe' : 'optimizer_engine';

/**
 * Backend configuration loaded from environment with sensible defaults.
 */
const config = {
  port: positiveInt(process.env.PORT, 5001),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  cppExecutablePath: process.env.CPP_EXECUTABLE_PATH ||
    path.resolve(__dirname, '../../algorithms/build', engineFile),
  // Built frontend served by this process in production (skipped when the folder is missing).
  staticDir: process.env.STATIC_DIR || path.resolve(__dirname, '../../frontend/dist'),
  executionTimeoutMs: positiveInt(process.env.EXECUTION_TIMEOUT_MS, 5000),
  maxConcurrentJobs: positiveInt(process.env.MAX_CONCURRENT_JOBS, os.cpus().length || 2),
  maxQueuedJobs: positiveInt(process.env.MAX_QUEUED_JOBS, 32),
  maxBodySize: process.env.MAX_BODY_SIZE || '2mb',
  // Bounds engine work per request: memory is O(stops x nodes), time O(stops x roads log nodes).
  limits: {
    maxNodes: positiveInt(process.env.MAX_NODES, 5000),
    maxRoads: positiveInt(process.env.MAX_ROADS, 20000),
    maxStops: positiveInt(process.env.MAX_STOPS, 100),
    // Fixed: the engine's own cap (Fleet::kMaxVehicles).
    maxVehicles: 10
  }
};

module.exports = config;
