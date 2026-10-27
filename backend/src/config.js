const path = require('path');

/**
 * Backend configuration loaded from environment with sensible defaults.
 */
const config = {
  port: parseInt(process.env.PORT || '5001', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  cppExecutablePath: process.env.CPP_EXECUTABLE_PATH ||
    path.resolve(__dirname, '../../algorithms/build/optimizer_engine'),
  executionTimeoutMs: parseInt(process.env.EXECUTION_TIMEOUT_MS || '5000', 10),
  maxBodySize: process.env.MAX_BODY_SIZE || '2mb'
};

module.exports = config;
