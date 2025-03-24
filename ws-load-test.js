const WebSocket = require('ws');
const os = require('os');

// Configuration
const URL = process.env.WS_URL || 'ws://localhost:8080';
const CONNECTIONS = process.env.CONNECTIONS || 200;
const RAMP_UP_INTERVAL = process.env.RAMP_UP_INTERVAL || 100; // ms
const RUNNING_TIME = process.env.RUNNING_TIME || 600000; // 10 minutes

// Stats
let activeConnections = 0;
let totalMessages = 0;
let failedConnections = 0;
let connectionsHistory = [];

// Track stats every second
setInterval(() => {
  connectionsHistory.push({
    timestamp: new Date(),
    activeConnections,
    totalMessages,
    failedConnections
  });
  
  // Log current status
  console.log(`Active: ${activeConnections}, Failed: ${failedConnections}, Messages: ${totalMessages}`);
}, 1000);

// Create connections
console.log(`Starting load test with ${CONNECTIONS} connections to ${URL}`);
console.log(`Running on ${os.hostname()} with ${os.cpus().length} CPUs`);

function createConnection(id) {
  try {
    const ws = new WebSocket(URL);
    
    ws.on('open', () => {
      activeConnections++;
      console.log(`Connection ${id} established. Active: ${activeConnections}`);
    });
    
    ws.on('message', (data) => {
      totalMessages++;
      // Only log every 1000 messages to avoid flooding the console
      if (totalMessages % 1000 === 0) {
        const message = JSON.parse(data);
        console.log(`Received message: CPU Load: ${message.cpu[0]}, Memory: ${message.memory.usage}%`);
      }
    });
    
    ws.on('close', () => {
      activeConnections--;
      console.log(`Connection ${id} closed. Active: ${activeConnections}`);
      
      // Reconnect after a short delay
      setTimeout(() => createConnection(id), 1000);
    });
    
    ws.on('error', (error) => {
      failedConnections++;
      console.error(`Connection ${id} error:`, error.message);
      
      // Don't immediately reconnect on error, wait a bit longer
      setTimeout(() => createConnection(id), 5000);
    });
    
    return ws;
  } catch (error) {
    failedConnections++;
    console.error(`Failed to create connection ${id}:`, error.message);
    return null;
  }
}

// Create connections with a ramp-up period
const connections = [];
for (let i = 0; i < CONNECTIONS; i++) {
  setTimeout(() => {
    const conn = createConnection(i);
    if (conn) connections.push(conn);
  }, i * RAMP_UP_INTERVAL);
}

// Print summary after test duration
setTimeout(() => {
  console.log('\n--- Test Summary ---');
  console.log(`Peak active connections: ${Math.max(...connectionsHistory.map(h => h.activeConnections))}`);
  console.log(`Total messages received: ${totalMessages}`);
  console.log(`Failed connection attempts: ${failedConnections}`);
  
  // Gracefully close connections
  console.log('Closing connections...');
  connections.forEach(conn => {
    if (conn && conn.readyState === WebSocket.OPEN) {
      conn.close();
    }
  });
  
  // Give time for connections to close before exiting
  setTimeout(() => process.exit(0), 5000);
}, RUNNING_TIME);
