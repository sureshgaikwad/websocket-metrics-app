// app.js - Main application file
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const promClient = require('prom-client');

// Create Express app
const app = express();

// Create and configure Prometheus metrics
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

// Custom metrics for WebSocket connections
const wsConnectionsGauge = new promClient.Gauge({
  name: 'websocket_connections_total',
  help: 'Total number of active WebSocket connections',
  registers: [register]
});

const wsMessagesCounter = new promClient.Counter({
  name: 'websocket_messages_total',
  help: 'Total number of WebSocket messages',
  labelNames: ['type'],
  registers: [register]
});

const wsLatencyHistogram = new promClient.Histogram({
  name: 'websocket_message_latency_seconds',
  help: 'Latency of WebSocket message processing in seconds',
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register]
});

// Custom metric for container operations
const containerOpsCounter = new promClient.Counter({
  name: 'container_operations_total',
  help: 'Total number of container operations',
  labelNames: ['operation', 'status'],
  registers: [register]
});

// Add Prometheus middleware to expose metrics
app.use('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Add health check endpoints
app.get('/health/live', (req, res) => {
  res.status(200).send('OK');
});

app.get('/health/ready', (req, res) => {
  res.status(200).send('Ready');
});

// Serve static files
app.use(express.static('public'));

// Simple API for container operations simulation
app.post('/api/container/create', (req, res) => {
  // Simulate container creation
  setTimeout(() => {
    containerOpsCounter.inc({ operation: 'create', status: 'success' });
    res.json({ status: 'success', message: 'Container created successfully' });
  }, 500);
});

app.post('/api/container/delete', (req, res) => {
  // Simulate container deletion
  setTimeout(() => {
    containerOpsCounter.inc({ operation: 'delete', status: 'success' });
    res.json({ status: 'success', message: 'Container deleted successfully' });
  }, 200);
});

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Track all active connections
const clients = new Set();

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`Client connected from ${clientIp}`);
  
  // Add to active clients and update gauge
  clients.add(ws);
  wsConnectionsGauge.set(clients.size);
  
  // Set up client properties
  ws.isAlive = true;
  ws.lastActivity = Date.now();
  
  // Handle pings to keep connection alive
  ws.on('pong', () => {
    ws.isAlive = true;
    ws.lastActivity = Date.now();
  });
  
  ws.on('message', (message) => {
    const start = process.hrtime();
    
    try {
      // Try to parse message as JSON
      let parsedMessage;
      try {
        parsedMessage = JSON.parse(message.toString());
      } catch (e) {
        parsedMessage = { text: message.toString() };
      }
      
      // Process message
      console.log(`Received from ${clientIp}:`, parsedMessage);
      wsMessagesCounter.inc({ type: 'received' });
      
      // Handle container operations via WebSocket if message has operation field
      if (parsedMessage.operation) {
        containerOpsCounter.inc({ 
          operation: parsedMessage.operation, 
          status: 'initiated' 
        });
        
        // Simulate processing delay based on operation
        setTimeout(() => {
          const response = {
            type: 'operation_response',
            operation: parsedMessage.operation,
            status: 'completed',
            timestamp: Date.now()
          };
          
          ws.send(JSON.stringify(response));
          containerOpsCounter.inc({ 
            operation: parsedMessage.operation, 
            status: 'completed' 
          });
          wsMessagesCounter.inc({ type: 'sent' });
        }, parsedMessage.operation === 'create' ? 800 : 300);
      } else {
        // Echo message back to client with timestamp
        const response = {
          type: 'echo',
          originalMessage: parsedMessage,
          timestamp: Date.now()
        };
        
        ws.send(JSON.stringify(response));
        wsMessagesCounter.inc({ type: 'sent' });
      }
      
      // Update last activity
      ws.lastActivity = Date.now();
      
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Error processing your message',
        error: error.message
      }));
      wsMessagesCounter.inc({ type: 'error' });
    }
    
    // Record latency
    const end = process.hrtime(start);
    const duration = end[0] + end[1] / 1e9;
    wsLatencyHistogram.observe(duration);
  });
  
  // Handle disconnect
  ws.on('close', () => {
    console.log(`Client disconnected from ${clientIp}`);
    clients.delete(ws);
    wsConnectionsGauge.set(clients.size);
  });
  
  // Handle errors
  ws.on('error', (error) => {
    console.error(`WebSocket error for ${clientIp}:`, error);
    clients.delete(ws);
    wsConnectionsGauge.set(clients.size);
  });
  
  // Send initial message
  const welcomeMessage = {
    type: 'welcome',
    message: 'Connected to WebSocket server',
    clientCount: clients.size,
    timestamp: Date.now()
  };
  
  ws.send(JSON.stringify(welcomeMessage));
  wsMessagesCounter.inc({ type: 'sent' });
});

// Ping all clients periodically to keep connections alive and detect dead connections
const pingInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log('Terminating inactive connection');
      return ws.terminate();
    }
    
    ws.isAlive = false;
    ws.ping();
    
    // Check for idle timeout (2 minutes)
    const idleTime = Date.now() - ws.lastActivity;
    if (idleTime > 120000) {
      console.log('Closing idle connection');
      ws.send(JSON.stringify({
        type: 'system',
        message: 'Closing due to inactivity',
        timestamp: Date.now()
      }));
      wsMessagesCounter.inc({ type: 'system' });
      ws.close();
    }
  });
}, 30000);

// Clean up interval on server close
wss.on('close', () => {
  clearInterval(pingInterval);
});

// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Metrics available at /metrics`);
  console.log(`WebSocket server ready for connections`);
});
