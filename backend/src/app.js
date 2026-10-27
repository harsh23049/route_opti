const express = require('express');
const cors = require('cors');
const config = require('./config');
const optimizeRoutes = require('./routes/optimizeRoutes');

const app = express();

// 1. Enable CORS strictly for the local frontend origin during development
app.use(cors({
  origin: config.frontendUrl,
  optionsSuccessStatus: 200
}));

// 2. Limit input size to prevent denial-of-service / memory overflow
app.use(express.json({ limit: config.maxBodySize }));

// 3. Handle malformed JSON syntax errors in request bodies
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'Malformed JSON syntax in request body',
      code: 'JSON_SYNTAX_ERROR'
    });
  }
  next(err);
});

// 4. Mount API Routes (/api/health and /api/optimize)
app.use('/api', optimizeRoutes);

// Root info route
app.get('/', (req, res) => {
  res.json({
    service: 'Smart Delivery Route Optimization API',
    endpoints: {
      health: 'GET /api/health',
      optimize: 'POST /api/optimize'
    }
  });
});

// 404 handler for unknown endpoints
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.originalUrl}`,
    code: 'NOT_FOUND'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[App Error]', err);
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR'
  });
});

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`[Backend] Smart Delivery Optimizer API listening on http://localhost:${config.port}`);
    console.log(`[Backend] CORS enabled for origin: ${config.frontendUrl}`);
    console.log(`[Backend] C++ Binary Path: ${config.cppExecutablePath}`);
  });
}

module.exports = app;
