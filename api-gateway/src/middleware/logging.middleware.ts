/**
 * Logging Middleware
 * Provides structured logging for requests and responses
 */

import { Request, Response, NextFunction } from 'express';
import morgan from 'morgan';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';

// Redis client for log aggregation
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Winston logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'api-gateway',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // File transport for errors
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // File transport for all logs
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  ]
});

// Add request ID to all requests
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  (req as any).id = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
};

// Extended Request interface
interface ExtendedRequest extends Request {
  id?: string;
  startTime?: number;
  userId?: string;
  companyId?: string;
}

// Custom token for Morgan
morgan.token('request-id', (req: ExtendedRequest) => req.id || '-');
morgan.token('user-id', (req: ExtendedRequest) => req.userId || '-');
morgan.token('company-id', (req: ExtendedRequest) => req.companyId || '-');
morgan.token('response-time-ms', (req: ExtendedRequest, res: Response) => {
  if (req.startTime) {
    return String(Date.now() - req.startTime);
  }
  return '-';
});

// Morgan middleware for HTTP logging
export const httpLogger = morgan(
  ':request-id :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time-ms ms',
  {
    stream: {
      write: (message: string) => {
        logger.info(message.trim());
      }
    }
  }
);

// Request logging middleware
export const requestLogger = (req: ExtendedRequest, res: Response, next: NextFunction) => {
  req.startTime = Date.now();
  
  // Log request
  const requestLog = {
    requestId: req.id,
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    headers: {
      'user-agent': req.headers['user-agent'],
      'content-type': req.headers['content-type'],
      'content-length': req.headers['content-length'],
    },
    ip: req.ip || req.socket.remoteAddress,
    userId: req.userId,
    companyId: req.companyId,
    timestamp: new Date().toISOString(),
  };
  
  // Don't log sensitive data
  if (!req.path.includes('/auth/') && !req.path.includes('/password')) {
    (requestLog as any).body = req.body;
  }
  
  logger.info('Request received', requestLog);
  
  // Log response
  const originalSend = res.send;
  res.send = function(data: any) {
    const responseTime = Date.now() - (req.startTime || Date.now());
    
    const responseLog = {
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime,
      contentLength: res.get('content-length'),
      timestamp: new Date().toISOString(),
    };
    
    // Log based on status code
    if (res.statusCode >= 500) {
      logger.error('Server error response', responseLog);
    } else if (res.statusCode >= 400) {
      logger.warn('Client error response', responseLog);
    } else {
      logger.info('Response sent', responseLog);
    }
    
    // Send metrics to Redis for aggregation
    sendMetrics({
      ...responseLog,
      userId: req.userId,
      companyId: req.companyId,
    });
    
    return originalSend.call(this, data);
  };
  
  next();
};

// Performance logging middleware
export const performanceLogger = (req: ExtendedRequest, res: Response, next: NextFunction) => {
  const startTime = process.hrtime.bigint();
  const startMemory = process.memoryUsage();
  
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();
    
    const duration = Number(endTime - startTime) / 1000000; // Convert to ms
    const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
    
    if (duration > 1000) { // Log slow requests (> 1s)
      logger.warn('Slow request detected', {
        requestId: req.id,
        method: req.method,
        path: req.path,
        duration,
        memoryDelta,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Track performance metrics
    sendPerformanceMetrics({
      requestId: req.id,
      path: req.path,
      method: req.method,
      duration,
      memoryDelta,
      statusCode: res.statusCode,
    });
  });
  
  next();
};

// Error logging middleware
export const errorLogger = (err: Error, req: ExtendedRequest, res: Response, next: NextFunction) => {
  const errorLog = {
    requestId: req.id,
    method: req.method,
    path: req.path,
    error: {
      message: err.message,
      stack: err.stack,
      name: err.name,
    },
    userId: req.userId,
    companyId: req.companyId,
    timestamp: new Date().toISOString(),
  };
  
  logger.error('Request error', errorLog);
  
  // Send error metrics
  sendErrorMetrics({
    requestId: req.id,
    path: req.path,
    method: req.method,
    errorType: err.name,
    statusCode: (err as any).statusCode || 500,
  });
  
  next(err);
};

// Audit logging for sensitive operations
export const auditLogger = (action: string, details?: any) => {
  return (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const auditLog = {
      requestId: req.id,
      action,
      userId: req.userId,
      companyId: req.companyId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      details,
      timestamp: new Date().toISOString(),
    };
    
    logger.info('Audit log', auditLog);
    
    // Store audit log in database
    storeAuditLog(auditLog);
    
    next();
  };
};

// Helper functions

async function sendMetrics(data: any) {
  try {
    const key = `metrics:requests:${new Date().toISOString().split('T')[0]}`;
    await redis.hincrby(key, `${data.method}:${data.statusCode}`, 1);
    await redis.expire(key, 86400 * 7); // Keep for 7 days
    
    // Store response time metrics
    const rtKey = `metrics:response_time:${new Date().toISOString().split('T')[0]}`;
    await redis.lpush(rtKey, data.responseTime);
    await redis.ltrim(rtKey, 0, 9999); // Keep last 10000 entries
    await redis.expire(rtKey, 86400 * 7);
  } catch (error) {
    logger.error('Failed to send metrics', error);
  }
}

async function sendPerformanceMetrics(data: any) {
  try {
    const key = `metrics:performance:${new Date().toISOString().split('T')[0]}`;
    await redis.hset(key, data.requestId, JSON.stringify(data));
    await redis.expire(key, 86400); // Keep for 1 day
  } catch (error) {
    logger.error('Failed to send performance metrics', error);
  }
}

async function sendErrorMetrics(data: any) {
  try {
    const key = `metrics:errors:${new Date().toISOString().split('T')[0]}`;
    await redis.hincrby(key, `${data.method}:${data.path}:${data.errorType}`, 1);
    await redis.expire(key, 86400 * 30); // Keep for 30 days
  } catch (error) {
    logger.error('Failed to send error metrics', error);
  }
}

async function storeAuditLog(log: any) {
  try {
    // Store in Redis for quick access
    const key = `audit:${log.userId || 'anonymous'}:${new Date().toISOString().split('T')[0]}`;
    await redis.lpush(key, JSON.stringify(log));
    await redis.ltrim(key, 0, 999); // Keep last 1000 entries
    await redis.expire(key, 86400 * 90); // Keep for 90 days
    
    // Also store in database (if available)
    // await db.query('INSERT INTO audit_logs ...', [...]);
  } catch (error) {
    logger.error('Failed to store audit log', error);
  }
}

// Export logger instance for use in other modules
export { logger };

// Structured logging helpers
export const log = {
  info: (message: string, meta?: any) => logger.info(message, meta),
  warn: (message: string, meta?: any) => logger.warn(message, meta),
  error: (message: string, meta?: any) => logger.error(message, meta),
  debug: (message: string, meta?: any) => logger.debug(message, meta),
  
  // Specific log types
  api: (message: string, meta?: any) => logger.info(`[API] ${message}`, meta),
  db: (message: string, meta?: any) => logger.info(`[DB] ${message}`, meta),
  auth: (message: string, meta?: any) => logger.info(`[AUTH] ${message}`, meta),
  perf: (message: string, meta?: any) => logger.info(`[PERF] ${message}`, meta),
};