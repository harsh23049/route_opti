const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    project: 'Smart Delivery Route Optimization API',
    status: 'running',
    version: '1.0.0-skeleton'
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'delivery-optimizer-backend',
    timestamp: new Date().toISOString()
  });
});

// Placeholder route optimization endpoint
app.post('/api/optimize', (req, res) => {
  const { stops, depot, algorithm } = req.body || {};
  res.json({
    status: 'placeholder',
    message: 'Optimization endpoint scaffolded. Ready for C++ algorithm engine integration.',
    received: {
      depot: depot || 'default-depot',
      stopCount: Array.isArray(stops) ? stops.length : 0,
      algorithm: algorithm || 'nearest_neighbor'
    }
  });
});

// Conditional start for direct execution
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[Backend] Smart Delivery Optimizer API listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
