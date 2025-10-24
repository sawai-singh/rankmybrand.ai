import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../database/connection';
import { User } from '../database/models';

export interface AuthRequest extends Request {
  user?: User;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
    
    // Verify user exists in database
    const user = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!user.rows[0]) {
      return res.status(401).json({ error: 'Invalid authentication' });
    }

    req.user = user.rows[0] as User;

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid authentication' });
  }
};

export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  // Check if user is authenticated first
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Check if user has admin role
  if (req.user.role !== 'admin' && !req.user.email?.endsWith('@rankmybrand.ai')) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
};