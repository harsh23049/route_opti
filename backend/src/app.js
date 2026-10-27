const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const optimizeRoutes = require('./routes/optimizeRoutes');

const app = express();
app.disable('x-powered-by');

// 1. CORS for the Vite dev server origin (production serves the UI from this same origin)
app.use(cors({
  origin: config.frontendUrl,
  optionsSuccessStatus: 200
}));

// 2. Limit input size to prevent denial-of-service / memory overflow
app.use(express.json({ limit: config.maxBodySize }));

// 3. Mount API Routes (/api/health and /api/optimize)
app.use('/api', optimizeRoutes);

// 4. Serve the built frontend when present (npm run build:frontend / Docker image)
const hasFrontendBuild = fs.existsSync(path.join(config.staticDir, 'index.html'));
if (hasFrontendBuild) {
  app.use(express.static(config.staticDir));
  // SPA fallback for client-side routes; /api paths still reach the JSON 404 below.
  app.get(/^\/(?!api(\/|$)).*/, (req, res) => res.sendFile(path.join(config.staticDir, 'index.html')));
} else {
  app.get('/', (req, res) => {
    res.json({
      service: 'Smart Delivery Route Optimization API',
      endpoints: {
        health: 'GET /api/health',
        optimize: 'POST /api/optimize'
      }
    });
  });
}

// 404 handler for unknown endpoints
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.originalUrl}`,
    code: 'NOT_FOUND'
  });
});

// Error handler: body-parser failures map to 4xx; anything else is a 500 without internals.
const BODY_ERRORS = {
  'entity.parse.failed': { code: 'JSON_SYNTAX_ERROR', message: 'Malformed JSON syntax in request body' },
  'entity.too.large': { code: 'PAYLOAD_TOO_LARGE', message: `Request body exceeds ${config.maxBodySize}` }
};

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by their 4 parameters
app.use((err, req, res, next) => {
  const known = BODY_ERRORS[err.type];
  const status = known ? err.status : 500;
  if (!known) console.error('[App Error]', err);
  res.status(status).json({
    success: false,
    error: known ? known.message : 'Internal server error',
    code: known ? known.code : 'INTERNAL_ERROR'
  });
});

if (require.main === module) {
  const server = app.listen(config.port, () => {
    console.log(`[Backend] Smart Delivery Optimizer API listening on http://localhost:${config.port}`);
    console.log(`[Backend] CORS enabled for origin: ${config.frontendUrl}`);
    console.log(`[Backend] C++ Binary Path: ${config.cppExecutablePath}`);
    console.log(`[Backend] Frontend build: ${hasFrontendBuild ? config.staticDir : 'not found (API only)'}`);
  });

  // Finish in-flight requests on container stop / Ctrl+C.
  const shutdown = (signal) => {
    console.log(`[Backend] ${signal} received, closing server`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = app;
