const express = require('express');
const fs = require('fs');
const router = express.Router();
const config = require('../config');
const { validateOptimizeInput } = require('../validators/validateRoute');
const { runOptimizer } = require('../services/cppRunner');

/**
 * GET /api/health
 * System health and C++ binary availability check.
 */
router.get('/health', (req, res) => {
  const binaryExists = fs.existsSync(config.cppExecutablePath);
  res.json({
    status: 'ok',
    service: 'delivery-optimizer-backend',
    executable: {
      path: config.cppExecutablePath,
      exists: binaryExists
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/optimize
 * Validates road network input and executes C++ optimization engine.
 */
router.post('/optimize', async (req, res) => {
  // 1. Validate request body and graph invariants
  const validation = validateOptimizeInput(req.body);
  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      error: validation.error,
      code: 'VALIDATION_ERROR'
    });
  }

  // 2. Invoke C++ binary via child_process.spawn
  try {
    const result = await runOptimizer(validation.normalizedPayload);
    return res.json(result);
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: err.message,
      code: err.code || 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;
