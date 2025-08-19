import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../database/connection';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
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
      'SELECT id, email, role FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!user.rows[0]) {
      return res.status(401).json({ error: 'Invalid authentication' });
    }

    req.user = {
      id: user.rows[0].id,
      email: user.rows[0].email,
      role: user.rows[0].role
    };

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