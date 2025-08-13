import winston from 'winston';
import path from 'path';

const logLevel = process.env.LOG_LEVEL || 'info';
const logFormat = process.env.LOG_FORMAT || 'json';
const nodeEnv = process.env.NODE_ENV || 'development';

const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] })
);

const jsonFormat = winston.format.combine(
  customFormat,
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  customFormat,
  winston.format.colorize(),
  winston.format.printf(({ level, message, timestamp, metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (metadata && Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: nodeEnv === 'development' ? consoleFormat : jsonFormat,
  })
];

// Add file transport in production
if (nodeEnv === 'production') {
  transports.push(
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      format: jsonFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      format: jsonFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

export const logger = winston.createLogger({
  level: logLevel,
  format: customFormat,
  transports,
  exitOnError: false,
});

// Create a stream for Morgan HTTP logging
export const httpLogStream = {
  write: (message: string) => {
    logger.info(message.trim(), { type: 'http' });
  },
};

// Helper functions for structured logging
export const logError = (message: string, error: Error, meta?: Record<string, any>) => {
  logger.error(message, {
    ...meta,
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
  });
};

export const logRequest = (req: any, meta?: Record<string, any>) => {
  logger.info('HTTP Request', {
    ...meta,
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      ip: req.ip,
      correlationId: req.correlationId,
    },
  });
};

export const logResponse = (req: any, res: any, meta?: Record<string, any>) => {
  logger.info('HTTP Response', {
    ...meta,
    response: {
      statusCode: res.statusCode,
      correlationId: req.correlationId,
    },
  });
};