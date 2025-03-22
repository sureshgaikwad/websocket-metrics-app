const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const os = require('os');
const prometheus = require('prom-client');

// Create Express application
const app = express();
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Initialize Prometheus metrics
prometheus.collectDefaultMetrics();
const websocketConnections = new prometheus.Gauge({
  name: 'websocket_active_connections',
  help: 'Number of active WebSocket connections'
});

const httpRequestsTotal = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status']
});

// Add error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  // Log but don't exit the process
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Log but don't exit the process
});

// Add request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
    httpRequestsTotal.inc({ method: req.method, route: req.url, status: res.statusCode });
  });
  next();
});

// Static files
app.use(express.static('public'));

// Health check endpoints
app.get('/health/live', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

app.get('/health/ready', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

// Metrics endpoint for Prometheus
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', prometheus.register.contentType);
  res.end(await prometheus.register.metrics());
});

// Root endpoint
app.get('/', (req, res) => {
  res.send('WebSocket Metrics Application - Connect to /ws for WebSocket endpoint');
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Client connected');
  websocketConnections.inc();
  
  // Send system metrics to client every second
  const interval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      const metrics = {
        timestamp: new Date().toISOString(),
        cpu: os.loadavg(),
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          usage: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2)
        },
        uptime: os.uptime()
      };
      
      ws.send(JSON.stringify(metrics));
    }
  }, 1000);
  
  ws.on('message', (message) => {
    console.log(`Received message: ${message}`);
    // Handle client messages if needed
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
    websocketConnections.dec();
    clearInterval(interval);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    // Handle error, but don't crash
  });
});

// Handle server errors
server.on('error', (error) => {
  console.error('Server error:', error);
  // Log the error but don't exit
});

// Start the server - Important: bind to 0.0.0.0, not localhost
const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health/live`);
  console.log(`Metrics endpoint: http://localhost:${PORT}/metrics`);
});
