import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import { config } from 'dotenv';
import pino from 'pino';

config();

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname'
    }
  }
});

// Redis clients for pub/sub
const pubClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const subClient = pubClient.duplicate();

// HTTP server for health checks
const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'websocket-server',
      timestamp: new Date().toISOString(),
      connections: io.engine.clientsCount,
      uptime: process.uptime()
    }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

// Socket.IO server
const io = new Server(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3003'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Authentication middleware
io.use(async (socket: Socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next(new Error('Authentication required'));
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || '') as any;
    socket.data.userId = decoded.userId || decoded.sub;
    socket.data.companyId = decoded.companyId;
    socket.data.role = decoded.role;
    
    logger.info({ userId: socket.data.userId }, 'Socket authenticated');
    next();
  } catch (error) {
    logger.error({ error }, 'Socket authentication failed');
    next(new Error('Invalid token'));
  }
});

// Connection handling
io.on('connection', (socket: Socket) => {
  const userId = socket.data.userId;
  const companyId = socket.data.companyId;
  
  logger.info({ 
    socketId: socket.id, 
    userId,
    companyId 
  }, 'Client connected');
  
  // Join user and company rooms
  if (userId) {
    socket.join(`user:${userId}`);
  }
  
  if (companyId) {
    socket.join(`company:${companyId}`);
  }
  
  // Subscribe to Redis channels
  socket.on('subscribe', (channels: string[]) => {
    channels.forEach(channel => {
      if (isAuthorizedForChannel(socket, channel)) {
        socket.join(channel);
        logger.info({ userId, channel }, 'Subscribed to channel');
      } else {
        socket.emit('error', { message: `Not authorized for channel: ${channel}` });
      }
    });
  });
  
  // Unsubscribe from channels
  socket.on('unsubscribe', (channels: string[]) => {
    channels.forEach(channel => {
      socket.leave(channel);
      logger.info({ userId, channel }, 'Unsubscribed from channel');
    });
  });
  
  // Handle custom events
  socket.on('analysis:start', async (data) => {
    if (!socket.data.userId) {
      return socket.emit('error', { message: 'Authentication required' });
    }
    
    // Publish to Redis for other services to handle
    await pubClient.publish('analysis:requests', JSON.stringify({
      userId: socket.data.userId,
      companyId: socket.data.companyId,
      ...data,
      requestedAt: new Date().toISOString()
    }));
    
    socket.emit('analysis:queued', { message: 'Analysis request queued' });
  });
  
  // Handle disconnection
  socket.on('disconnect', (reason) => {
    logger.info({ 
      socketId: socket.id, 
      userId,
      reason 
    }, 'Client disconnected');
  });
  
  // Error handling
  socket.on('error', (error) => {
    logger.error({ 
      socketId: socket.id, 
      userId,
      error 
    }, 'Socket error');
  });
});

// Redis subscription handling
subClient.on('message', (channel: string, message: string) => {
  try {
    const data = JSON.parse(message);
    
    switch (channel) {
      case 'geo:updates':
        io.to(`company:${data.companyId}`).emit('geo:update', data);
        break;
        
      case 'analysis:progress':
        io.to(`user:${data.userId}`).emit('analysis:progress', data);
        break;
        
      case 'analysis:complete':
        io.to(`user:${data.userId}`).emit('analysis:complete', data);
        break;
        
      case 'insights:new':
        io.to(`company:${data.companyId}`).emit('insight:new', data);
        break;
        
      case 'competitors:update':
        io.to(`company:${data.companyId}`).emit('competitors:update', data);
        break;
        
      case 'alerts:critical':
        io.to(`company:${data.companyId}`).emit('alert:critical', data);
        break;
        
      default:
        // Broadcast to channel subscribers
        io.to(channel).emit('message', data);
    }
    
    logger.debug({ channel, data }, 'Message broadcasted');
  } catch (error) {
    logger.error({ error, channel, message }, 'Failed to process Redis message');
  }
});

// Subscribe to Redis channels
const redisChannels = [
  'geo:updates',
  'analysis:progress',
  'analysis:complete',
  'insights:new',
  'competitors:update',
  'alerts:critical',
  'system:notifications'
];

subClient.subscribe(...redisChannels, (err, count) => {
  if (err) {
    logger.error({ error: err }, 'Failed to subscribe to Redis channels');
    process.exit(1);
  }
  logger.info({ channels: redisChannels, count }, 'Subscribed to Redis channels');
});

// Authorization helper
function isAuthorizedForChannel(socket: Socket, channel: string): boolean {
  const userId = socket.data.userId;
  const companyId = socket.data.companyId;
  const role = socket.data.role;
  
  // Public channels
  if (channel.startsWith('public:')) {
    return true;
  }
  
  // User-specific channels
  if (channel.startsWith('user:') && channel === `user:${userId}`) {
    return true;
  }
  
  // Company-specific channels
  if (channel.startsWith('company:') && channel === `company:${companyId}`) {
    return true;
  }
  
  // Admin channels
  if (channel.startsWith('admin:') && role === 'admin') {
    return true;
  }
  
  return false;
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  io.close(() => {
    logger.info('Socket.IO server closed');
  });
  
  await pubClient.quit();
  await subClient.quit();
  
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

// Start server
const PORT = parseInt(process.env.PORT || '3001', 10);
httpServer.listen(PORT, () => {
  logger.info(`WebSocket server running on http://localhost:${PORT}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
});