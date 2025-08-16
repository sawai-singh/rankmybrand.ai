/**
 * Error Handling Middleware
 * Provides centralized error handling for the API Gateway
 */

import { Request, Response, NextFunction } from 'express';

// Custom error class
export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;
  details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    message: string,
    isOperational: boolean = true,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Common error factory functions
export const BadRequestError = (message: string, details?: Record<string, unknown>) => 
  new ApiError(400, message, true, details);

export const UnauthorizedError = (message: string = 'Unauthorized') => 
  new ApiError(401, message);

export const ForbiddenError = (message: string = 'Forbidden') => 
  new ApiError(403, message);

export const NotFoundError = (resource: string = 'Resource') => 
  new ApiError(404, `${resource} not found`);

export const ConflictError = (message: string) => 
  new ApiError(409, message);

export const ValidationError = (errors: Record<string, string>) => 
  new ApiError(422, 'Validation failed', true, { errors });

export const TooManyRequestsError = (message: string = 'Too many requests') => 
  new ApiError(429, message);

export const InternalServerError = (message: string = 'Internal server error') => 
  new ApiError(500, message, false);

export const ServiceUnavailableError = (service: string) => 
  new ApiError(503, `${service} service is unavailable`);

// Async error handler wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Error response formatter
interface ErrorResponse {
  error: {
    message: string;
    code?: string;
    statusCode: number;
    details?: Record<string, unknown>;
    timestamp: string;
    path: string;
    method: string;
    requestId?: string;
  };
  stack?: string;
}

// Main error handling middleware
export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Default to 500 server error
  let statusCode = 500;
  let message = 'Internal Server Error';
  let details: Record<string, unknown> | undefined;
  let isOperational = false;

  // Handle different error types
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
    isOperational = err.isOperational;
  } else if (err.name === 'ValidationError') {
    // Mongoose/Sequelize validation error
    statusCode = 422;
    message = 'Validation Error';
    isOperational = true;
  } else if (err.name === 'CastError') {
    // Mongoose cast error
    statusCode = 400;
    message = 'Invalid ID format';
    isOperational = true;
  } else if (err.name === 'JsonWebTokenError') {
    // JWT error
    statusCode = 401;
    message = 'Invalid token';
    isOperational = true;
  } else if (err.name === 'TokenExpiredError') {
    // JWT expired
    statusCode = 401;
    message = 'Token expired';
    isOperational = true;
  } else if (err.name === 'SyntaxError' && 'body' in err) {
    // JSON parse error
    statusCode = 400;
    message = 'Invalid JSON payload';
    isOperational = true;
  }

  // Log error
  const logLevel = isOperational ? 'warn' : 'error';
  console[logLevel]({
    error: err.message,
    statusCode,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    requestId: (req as any).id,
    stack: err.stack,
  });

  // Prepare error response
  const errorResponse: ErrorResponse = {
    error: {
      message,
      statusCode,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
      requestId: (req as any).id,
    },
  };

  // Add details if available
  if (details) {
    errorResponse.error.details = details;
  }

  // Add error code if available
  if (err.name && err.name !== 'Error') {
    errorResponse.error.code = err.name;
  }

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

// 404 Not Found middleware
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new ApiError(
    404,
    `Endpoint ${req.method} ${req.path} not found`,
    true,
    {
      availableEndpoints: [
        'GET /health',
        'GET /status',
        'GET /api/docs',
        'POST /api/auth/login',
        'POST /api/auth/register',
        'POST /api/onboarding/validate-email',
        'POST /api/analyze/instant',
        'POST /api/analyze/complete',
      ],
    }
  );
  next(error);
};

// Request timeout middleware
export const timeoutHandler = (timeout: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const timer = setTimeout(() => {
      const error = new ApiError(
        408,
        'Request timeout',
        true,
        { timeout: `${timeout}ms` }
      );
      next(error);
    }, timeout);

    res.on('finish', () => {
      clearTimeout(timer);
    });

    next();
  };
};

// Payload size error handler
export const payloadTooLargeHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err.type === 'entity.too.large') {
    const error = new ApiError(
      413,
      'Payload too large',
      true,
      { maxSize: '10MB' }
    );
    return next(error);
  }
  next(err);
};