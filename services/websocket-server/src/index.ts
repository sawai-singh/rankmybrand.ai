/**
 * WebSocket Server for RankMyBrand.ai
 * Bridges Redis Streams to WebSocket clients for real-time updates
 */

import WebSocket, { WebSocketServer } from 'ws';
import express from 'express';
import cors from 'cors';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import * as http from 'http';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const PORT = process.env.WS_PORT || 3001;
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');

// Redis clients
const redisSubscriber = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

const redisClient = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
});

// Express app for health checks
const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    clients: clients.size,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ 
  server,
  path: '/ws',
});

// Client management
interface Client {
  id: string;
  ws: WebSocket;
  subscriptions: Set<string>;
  isAlive: boolean;
}

const clients = new Map<string, Client>();

// Redis Streams consumer groups
const CONSUMER_GROUP = 'websocket-server';
const CONSUMER_NAME = `websocket-${process.pid}`;

// Streams to monitor
const STREAMS = [
  'metrics.calculated',
  'recommendations.ready',
  'automation.status',
  'system.health',
  'gaps.identified',
];

/**
 * Initialize Redis Stream consumers
 */
async function initializeStreamConsumers() {
  for (const stream of STREAMS) {
    try {
      // Create consumer group if it doesn't exist
      await redisClient.xgroup('CREATE', stream, CONSUMER_GROUP, '$', 'MKSTREAM');
      console.log(`Created consumer group for stream: ${stream}`);
    } catch (error: any) {
      if (!error.message.includes('BUSYGROUP')) {
        console.error(`Error creating consumer group for ${stream}:`, error);
      }
    }
  }

  // Start consuming streams
  consumeStreams();
}

/**
 * Consume messages from Redis Streams
 */
async function consumeStreams() {
  while (true) {
    try {
      // Read from multiple streams
      const results = await redisClient.xreadgroup(
        'GROUP',
        CONSUMER_GROUP,
        CONSUMER_NAME,
        'BLOCK',
        1000, // Block for 1 second
        'COUNT',
        10,
        'STREAMS',
        ...STREAMS,
        ...STREAMS.map(() => '>')
      );

      if (results) {
        for (const [stream, messages] of results) {
          for (const [id, fields] of messages) {
            await processStreamMessage(stream, id, fields);
          }
        }
      }
    } catch (error) {
      console.error('Error consuming streams:', error);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

/**
 * Process a message from Redis Stream
 */
async function processStreamMessage(stream: string, id: string, fields: string[]) {
  try {
    // Convert field array to object
    const data: any = {};
    for (let i = 0; i < fields.length; i += 2) {
      const key = fields[i];
      const value = fields[i + 1];
      try {
        data[key] = JSON.parse(value);
      } catch {
        data[key] = value;
      }
    }

    // Determine message type based on stream
    let messageType: string;
    switch (stream) {
      case 'metrics.calculated':
        messageType = 'metrics';
        break;
      case 'recommendations.ready':
        messageType = 'recommendations';
        break;
      case 'automation.status':
        messageType = 'automation';
        break;
      case 'system.health':
        messageType = 'system';
        break;
      case 'gaps.identified':
        messageType = 'gaps';
        break;
      default:
        messageType = 'unknown';
    }

    // Broadcast to all connected clients
    broadcastMessage({
      type: messageType,
      data,
      timestamp: new Date().toISOString(),
      streamId: id,
    });

    // Acknowledge message
    await redisClient.xack(stream, CONSUMER_GROUP, id);
  } catch (error) {
    console.error('Error processing stream message:', error);
  }
}

/**
 * Broadcast message to all connected clients
 */
function broadcastMessage(message: any) {
  const messageStr = JSON.stringify(message);
  
  clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(messageStr);
    }
  });
}

/**
 * Broadcast to specific clients based on subscription
 */
function broadcastToSubscribers(stream: string, message: any) {
  const messageStr = JSON.stringify(message);
  
  clients.forEach((client) => {
    if (client.subscriptions.has(stream) && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(messageStr);
    }
  });
}

/**
 * Handle WebSocket connections
 */
wss.on('connection', (ws: WebSocket, req) => {
  const clientId = uuidv4();
  const client: Client = {
    id: clientId,
    ws,
    subscriptions: new Set(STREAMS), // Subscribe to all streams by default
    isAlive: true,
  };
  
  clients.set(clientId, client);
  console.log(`Client connected: ${clientId} (Total: ${clients.size})`);

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    clientId,
    streams: Array.from(client.subscriptions),
  }));

  // Handle ping/pong for connection health
  ws.on('pong', () => {
    client.isAlive = true;
  });

  // Handle messages from client
  ws.on('message', async (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      await handleClientMessage(client, message);
    } catch (error) {
      console.error('Error handling client message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format',
      }));
    }
  });

  // Handle client disconnect
  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`Client disconnected: ${clientId} (Total: ${clients.size})`);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error(`WebSocket error for client ${clientId}:`, error);
  });
});

/**
 * Handle messages from WebSocket clients
 */
async function handleClientMessage(client: Client, message: any) {
  switch (message.type) {
    case 'ping':
      client.ws.send(JSON.stringify({ type: 'pong' }));
      break;

    case 'subscribe':
      if (message.streams && Array.isArray(message.streams)) {
        message.streams.forEach((stream: string) => {
          client.subscriptions.add(stream);
        });
        client.ws.send(JSON.stringify({
          type: 'subscribed',
          streams: Array.from(client.subscriptions),
        }));
      }
      break;

    case 'unsubscribe':
      if (message.streams && Array.isArray(message.streams)) {
        message.streams.forEach((stream: string) => {
          client.subscriptions.delete(stream);
        });
        client.ws.send(JSON.stringify({
          type: 'unsubscribed',
          streams: Array.from(client.subscriptions),
        }));
      }
      break;

    case 'request':
      await handleDataRequest(client, message.resource);
      break;

    case 'action':
      await handleAction(client, message);
      break;

    default:
      client.ws.send(JSON.stringify({
        type: 'error',
        message: `Unknown message type: ${message.type}`,
      }));
  }
}

/**
 * Handle data requests from clients
 */
async function handleDataRequest(client: Client, resource: string) {
  try {
    switch (resource) {
      case 'metrics':
        // Fetch latest metrics from Redis or database
        const metrics = await fetchLatestMetrics();
        client.ws.send(JSON.stringify({
          type: 'metrics',
          data: metrics,
          timestamp: new Date().toISOString(),
        }));
        break;

      case 'recommendations':
        // Fetch recent recommendations
        const recommendations = await fetchRecommendations();
        client.ws.send(JSON.stringify({
          type: 'recommendations',
          data: recommendations,
          timestamp: new Date().toISOString(),
        }));
        break;

      case 'competitors':
        // Fetch competitor data
        const competitors = await fetchCompetitors();
        client.ws.send(JSON.stringify({
          type: 'competitors',
          data: competitors,
          timestamp: new Date().toISOString(),
        }));
        break;

      default:
        client.ws.send(JSON.stringify({
          type: 'error',
          message: `Unknown resource: ${resource}`,
        }));
    }
  } catch (error) {
    console.error(`Error fetching ${resource}:`, error);
    client.ws.send(JSON.stringify({
      type: 'error',
      message: `Failed to fetch ${resource}`,
    }));
  }
}

/**
 * Handle actions from clients
 */
async function handleAction(client: Client, message: any) {
  try {
    switch (message.action) {
      case 'approve-recommendation':
        // Publish to action stream
        await redisClient.xadd(
          'actions.requests',
          '*',
          'action', 'approve',
          'recommendationId', message.recommendationId,
          'clientId', client.id,
          'timestamp', new Date().toISOString()
        );
        break;

      case 'reject-recommendation':
        await redisClient.xadd(
          'actions.requests',
          '*',
          'action', 'reject',
          'recommendationId', message.recommendationId,
          'clientId', client.id,
          'timestamp', new Date().toISOString()
        );
        break;

      default:
        client.ws.send(JSON.stringify({
          type: 'error',
          message: `Unknown action: ${message.action}`,
        }));
    }
  } catch (error) {
    console.error('Error handling action:', error);
    client.ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to process action',
    }));
  }
}

/**
 * Fetch latest metrics (mock implementation - replace with actual DB query)
 */
async function fetchLatestMetrics() {
  // In production, query from PostgreSQL or Redis cache
  return {
    geoScore: 78,
    shareOfVoice: 24.5,
    sentiment: {
      positive: 65,
      neutral: 25,
      negative: 10,
    },
    citationCount: 142,
    platformScores: {
      chatgpt: 82,
      claude: 79,
      perplexity: 75,
      gemini: 71,
    },
  };
}

/**
 * Fetch recommendations (mock implementation - replace with actual DB query)
 */
async function fetchRecommendations() {
  // In production, query from PostgreSQL
  return [
    {
      id: '1',
      title: 'Add FAQ Schema to Product Pages',
      description: 'Implement FAQ schema markup to improve visibility in AI responses',
      priority: 'high',
      impact: 35,
      effort: 'low',
      status: 'pending',
      type: 'schema',
      createdAt: new Date().toISOString(),
    },
  ];
}

/**
 * Fetch competitors (mock implementation - replace with actual DB query)
 */
async function fetchCompetitors() {
  // In production, query from PostgreSQL
  return [
    {
      id: '1',
      name: 'Competitor A',
      geoScore: 72,
      shareOfVoice: 18.3,
      position: [3, 2, -1],
      color: '#ef4444',
    },
    {
      id: '2',
      name: 'Competitor B',
      geoScore: 68,
      shareOfVoice: 15.7,
      position: [-2, -1, 1],
      color: '#f59e0b',
    },
  ];
}

/**
 * Heartbeat interval to check client connections
 */
setInterval(() => {
  clients.forEach((client) => {
    if (!client.isAlive) {
      client.ws.terminate();
      clients.delete(client.id);
      return;
    }
    
    client.isAlive = false;
    client.ws.ping();
  });
}, 30000);

/**
 * Start the server
 */
async function start() {
  try {
    // Initialize Redis Stream consumers
    await initializeStreamConsumers();

    // Start HTTP/WebSocket server
    server.listen(PORT, () => {
      console.log(`WebSocket server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing connections...');
  
  // Close all WebSocket connections
  clients.forEach((client) => {
    client.ws.close(1000, 'Server shutting down');
  });
  
  // Close server
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start the server
start();