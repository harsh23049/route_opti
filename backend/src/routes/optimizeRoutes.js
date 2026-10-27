const express = require('express');
const fs = require('fs');
const router = express.Router();
const config = require('../config');
const { validateOptimizeInput } = require('../validators/validateRoute');
const { runOptimizer } = require('../services/cppRunner');

/**
 * GET /api/health
 * System health and C++ binary availability check.
 * The binary path stays in server logs; it is not exposed to clients.
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'delivery-optimizer-backend',
    executable: {
      exists: fs.existsSync(config.cppExecutablePath)
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
    if (status >= 500 && err.code !== 'ENGINE_BUSY') {
      console.error('[optimize] Engine failure:', err);
    }
    return res.status(status).json({
      success: false,
      error: err.code ? err.message : 'Internal server error',
      code: err.code || 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;
