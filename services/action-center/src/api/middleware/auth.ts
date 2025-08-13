import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../../lib/logger';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export function authentication(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  // Skip auth for health checks
  if (req.path.startsWith('/api/health')) {
    return next();
  }

  // Get token from header
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'No authorization header provided'
    });
    return;
  }

  const token = authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : authHeader;

  // Verify token
  try {
    const secret = process.env.JWT_SECRET || 'default-secret-change-me';
    const decoded = jwt.verify(token, secret) as any;
    
    req.user = {
      id: decoded.sub || decoded.id,
      email: decoded.email,
      role: decoded.role || 'user'
    };
    
    next();
  } catch (error) {
    logger.error('Authentication failed:', error);
    
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token'
    });
  }
}

export function authorize(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated'
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
      return;
    }

    next();
  };
}