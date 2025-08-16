/**
 * Validation Middleware
 * Provides request validation using Zod schemas
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { ApiError } from './error.middleware';

// Validation source types
type ValidationSource = 'body' | 'query' | 'params' | 'headers';

// Validation middleware factory
export const validate = (
  schema: ZodSchema,
  source: ValidationSource = 'body'
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dataToValidate = req[source];
      const validated = await schema.parseAsync(dataToValidate);
      
      // Replace the source with validated data
      req[source] = validated;
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = (error as any).errors.reduce((acc: Record<string, string>, err: any) => {
          const path = err.path.join('.');
          acc[path] = err.message;
          return acc;
        }, {} as Record<string, string>);
        
        const apiError = new ApiError(
          422,
          'Validation failed',
          true,
          { errors }
        );
        
        next(apiError);
      } else {
        next(error);
      }
    }
  };
};

// Common validation schemas
export const schemas = {
  // Pagination
  pagination: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    sort_by: z.string().optional(),
    sort_order: z.enum(['asc', 'desc']).default('desc'),
  }),

  // Email validation
  email: z.string().email('Invalid email format'),

  // Domain validation
  domain: z.string().regex(
    /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i,
    'Invalid domain format'
  ),

  // UUID validation
  uuid: z.string().uuid('Invalid UUID format'),

  // Date range
  dateRange: z.object({
    from: z.coerce.date(),
    to: z.coerce.date(),
  }).refine(
    data => data.from <= data.to,
    'From date must be before or equal to to date'
  ),

  // Password validation
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),

  // Phone number validation
  phone: z.string().regex(
    /^\+?[1-9]\d{1,14}$/,
    'Invalid phone number format'
  ),

  // URL validation
  url: z.string().url('Invalid URL format'),
};

// Specific route validation schemas
export const routeSchemas = {
  // Auth routes
  auth: {
    login: z.object({
      email: schemas.email,
      password: z.string().min(1, 'Password is required'),
    }),
    
    register: z.object({
      email: schemas.email,
      password: schemas.password,
      first_name: z.string().min(1).max(50).optional(),
      last_name: z.string().min(1).max(50).optional(),
      company_name: z.string().min(1).max(100).optional(),
    }),
    
    forgotPassword: z.object({
      email: schemas.email,
    }),
    
    resetPassword: z.object({
      token: z.string().min(1),
      password: schemas.password,
    }),
    
    magicLink: z.object({
      email: schemas.email,
    }),
  },

  // Onboarding routes
  onboarding: {
    validateEmail: z.object({
      email: schemas.email,
    }),
    
    enrich: z.object({
      email: schemas.email,
    }),
    
    generateDescription: z.object({
      sessionId: z.string().min(1),
      company: z.object({
        name: z.string(),
        domain: schemas.domain,
        industry: z.string().optional(),
      }),
      crawledPages: z.array(z.any()).optional(),
    }),
    
    findCompetitors: z.object({
      sessionId: z.string().min(1),
      company: z.object({
        name: z.string(),
        domain: schemas.domain,
        industry: z.string().optional(),
      }),
    }),
    
    complete: z.object({
      sessionId: z.string().min(1),
      email: schemas.email,
      company: z.object({
        name: z.string(),
        domain: schemas.domain,
      }),
      competitors: z.array(z.object({
        name: z.string(),
        domain: schemas.domain,
      })).optional(),
      description: z.string().optional(),
    }),
  },

  // Analysis routes
  analysis: {
    instant: z.object({
      domain: schemas.domain,
    }),
    
    complete: z.object({
      domain: schemas.domain,
      keywords: z.array(z.string()).optional(),
    }),
    
    competitors: z.object({
      domains: z.array(schemas.domain).min(2).max(10),
    }),
    
    batch: z.object({
      domains: z.array(schemas.domain).min(1).max(50),
      options: z.object({
        depth: z.number().min(1).max(5).optional(),
        includeCompetitors: z.boolean().optional(),
      }).optional(),
    }),
  },

  // Company routes
  company: {
    create: z.object({
      name: z.string().min(1).max(200),
      domain: schemas.domain,
      description: z.string().max(1000).optional(),
      industry: z.string().max(100).optional(),
      company_size: z.enum(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']).optional(),
      employee_count: z.number().min(1).optional(),
    }),
    
    update: z.object({
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(1000).optional(),
      industry: z.string().max(100).optional(),
      company_size: z.string().optional(),
      employee_count: z.number().min(1).optional(),
    }),
    
    search: z.object({
      query: z.string().optional(),
      industry: z.string().optional(),
      minScore: z.coerce.number().min(0).max(100).optional(),
      maxScore: z.coerce.number().min(0).max(100).optional(),
      hasAnalysis: z.coerce.boolean().optional(),
    }),
  },

  // User routes
  user: {
    update: z.object({
      first_name: z.string().min(1).max(50).optional(),
      last_name: z.string().min(1).max(50).optional(),
      phone: schemas.phone.optional(),
      timezone: z.string().optional(),
      settings: z.record(z.string(), z.unknown()).optional(),
      preferences: z.record(z.string(), z.unknown()).optional(),
    }),
    
    changePassword: z.object({
      current_password: z.string().min(1),
      new_password: schemas.password,
    }),
  },
};

// Sanitization helpers
export const sanitize = {
  // Remove HTML tags
  stripHtml: (input: string): string => {
    return input.replace(/<[^>]*>/g, '');
  },

  // Escape special characters
  escape: (input: string): string => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
    };
    
    return input.replace(/[&<>"'/]/g, (char) => map[char]);
  },

  // Normalize whitespace
  normalizeWhitespace: (input: string): string => {
    return input.replace(/\s+/g, ' ').trim();
  },

  // Remove non-printable characters
  removeNonPrintable: (input: string): string => {
    return input.replace(/[^\x20-\x7E]/g, '');
  },
};

// Request sanitization middleware
export const sanitizeRequest = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  
  // Sanitize query
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  
  // Sanitize params
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }
  
  next();
};

// Helper function to recursively sanitize objects
function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return sanitize.normalizeWhitespace(sanitize.stripHtml(obj));
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip keys that look suspicious
      if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
        continue;
      }
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
}

// Custom validation rules
export const customValidators = {
  // Check if string contains SQL injection patterns
  noSqlInjection: (value: string): boolean => {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|FROM|WHERE)\b)/gi,
      /(--|#|\/\*|\*\/|;|'|"|`|\\x00|\\n|\\r|\\x1a)/g,
    ];
    
    return !sqlPatterns.some(pattern => pattern.test(value));
  },

  // Check if string contains XSS patterns
  noXss: (value: string): boolean => {
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
    ];
    
    return !xssPatterns.some(pattern => pattern.test(value));
  },

  // Validate file upload
  isValidFile: (file: any, options: {
    maxSize?: number;
    allowedTypes?: string[];
  } = {}): boolean => {
    const { maxSize = 10485760, allowedTypes = ['image/jpeg', 'image/png', 'image/gif'] } = options;
    
    if (file.size > maxSize) {
      return false;
    }
    
    if (!allowedTypes.includes(file.mimetype)) {
      return false;
    }
    
    return true;
  },
};