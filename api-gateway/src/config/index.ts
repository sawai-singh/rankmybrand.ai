/**
 * Configuration Management
 * Centralized configuration with validation and type safety
 */

import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Environment variable schema
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  GATEWAY_PORT: z.coerce.number().default(4000),
  APP_VERSION: z.string().default('1.0.0'),
  
  // Database
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(5433),
  DB_NAME: z.string().default('rankmybrand'),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default('postgres'),
  DB_POOL_SIZE: z.coerce.number().default(20),
  DB_SSL: z.coerce.boolean().default(false),
  
  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_PASSWORD: z.string().optional(),
  
  // JWT
  JWT_SECRET: z.string().min(32).default('your-super-secret-jwt-key-change-this-in-production'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  
  // Services
  GEO_SERVICE: z.string().url().default('http://localhost:8000'),
  CRAWLER_SERVICE: z.string().url().default('http://localhost:3002'),
  SEARCH_SERVICE: z.string().url().default('http://localhost:3002'),
  DASHBOARD_SERVICE: z.string().url().default('http://localhost:3000'),
  // WEBSOCKET_SERVICE removed - using integrated WebSocket
  INTELLIGENCE_SERVICE: z.string().url().default('http://localhost:8002'),
  // ACTION_SERVICE removed - service not in use
  
  // CORS
  CORS_ORIGIN: z.string().default('*'),
  CORS_CREDENTIALS: z.coerce.boolean().default(true),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(1000),
  RATE_LIMIT_STRICT_MAX: z.coerce.number().default(100),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FORMAT: z.enum(['json', 'simple']).default('json'),
  
  // Email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
  
  // External APIs
  OPENAI_API_KEY: z.string().optional(),
  CLEARBIT_API_KEY: z.string().optional(),
  HUNTER_API_KEY: z.string().optional(),
  APOLLO_API_KEY: z.string().optional(),
  VALUESERP_API_KEY: z.string().optional(),
  SERPER_API_KEY: z.string().optional(),
  
  // Security
  BCRYPT_ROUNDS: z.coerce.number().default(10),
  SESSION_SECRET: z.string().min(32).default('your-session-secret-change-this'),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  COOKIE_HTTP_ONLY: z.coerce.boolean().default(true),
  COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('lax'),
  
  // File Upload
  MAX_FILE_SIZE: z.coerce.number().default(10485760), // 10MB
  ALLOWED_FILE_TYPES: z.string().default('image/jpeg,image/png,image/gif,application/pdf'),
  
  // Monitoring
  SENTRY_DSN: z.string().optional(),
  NEW_RELIC_LICENSE_KEY: z.string().optional(),
  DATADOG_API_KEY: z.string().optional(),
});

// Parse and validate environment variables
const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid environment variables:');
      (error as any).errors.forEach((err: any) => {
        console.error(`  ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
};

// Validated configuration
const env = parseEnv();

// Derived configuration
export const config = {
  // Environment
  env: env.NODE_ENV,
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  
  // Server
  server: {
    port: env.GATEWAY_PORT,
    version: env.APP_VERSION,
  },
  
  // Database
  database: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    max: env.DB_POOL_SIZE,
    ssl: env.DB_SSL ? { rejectUnauthorized: false } : undefined,
    connectionString: `postgresql://${env.DB_USER}:${env.DB_PASSWORD}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`,
  },
  
  // Redis
  redis: {
    url: env.REDIS_URL,
    password: env.REDIS_PASSWORD,
    options: {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
    },
  },
  
  // JWT
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },
  
  // Services
  services: {
    geo: env.GEO_SERVICE,
    crawler: env.CRAWLER_SERVICE,
    search: env.SEARCH_SERVICE,
    dashboard: env.DASHBOARD_SERVICE,
    // websocket: removed - using integrated WebSocket
    intelligence: env.INTELLIGENCE_SERVICE,
    // action: removed - service not in use
  },
  
  // CORS
  cors: {
    origin: env.CORS_ORIGIN.split(',').map(o => o.trim()),
    credentials: env.CORS_CREDENTIALS,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-CSRF-Token'],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX_REQUESTS,
    strictMax: env.RATE_LIMIT_STRICT_MAX,
    message: 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  // Logging
  logging: {
    level: env.LOG_LEVEL,
    format: env.LOG_FORMAT,
  },
  
  // Email
  email: {
    smtp: {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      auth: env.SMTP_USER && env.SMTP_PASSWORD ? {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD,
      } : undefined,
    },
    from: env.SMTP_FROM,
  },
  
  // External APIs
  apis: {
    openai: env.OPENAI_API_KEY,
    clearbit: env.CLEARBIT_API_KEY,
    hunter: env.HUNTER_API_KEY,
    apollo: env.APOLLO_API_KEY,
    valueserp: env.VALUESERP_API_KEY,
    serper: env.SERPER_API_KEY,
  },
  
  // Security
  security: {
    bcryptRounds: env.BCRYPT_ROUNDS,
    sessionSecret: env.SESSION_SECRET,
    cookie: {
      secure: env.COOKIE_SECURE,
      httpOnly: env.COOKIE_HTTP_ONLY,
      sameSite: env.COOKIE_SAME_SITE,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  },
  
  // File Upload
  upload: {
    maxSize: env.MAX_FILE_SIZE,
    allowedTypes: env.ALLOWED_FILE_TYPES.split(',').map(t => t.trim()),
  },
  
  // Monitoring
  monitoring: {
    sentry: env.SENTRY_DSN,
    newRelic: env.NEW_RELIC_LICENSE_KEY,
    datadog: env.DATADOG_API_KEY,
  },
};

// Validate critical configuration
export const validateConfig = () => {
  const errors: string[] = [];
  
  // Check JWT secret in production
  if (config.isProduction) {
    if (config.jwt.secret === 'your-super-secret-jwt-key-change-this-in-production') {
      errors.push('JWT_SECRET must be changed in production');
    }
    
    if (config.security.sessionSecret === 'your-session-secret-change-this') {
      errors.push('SESSION_SECRET must be changed in production');
    }
    
    if (!config.security.cookie.secure) {
      errors.push('Cookies should be secure in production');
    }
  }
  
  // Check database connection
  if (!config.database.host || !config.database.database) {
    errors.push('Database configuration is incomplete');
  }
  
  // Check Redis connection
  if (!config.redis.url) {
    errors.push('Redis URL is not configured');
  }
  
  if (errors.length > 0) {
    console.error('❌ Configuration errors:');
    errors.forEach(err => console.error(`  - ${err}`));
    if (config.isProduction) {
      process.exit(1);
    }
  } else {
    console.log('✅ Configuration validated successfully');
  }
};

// Export type-safe environment variables
export type Config = typeof config;
export type Environment = typeof env;

// Helper to get config value with fallback
export const getConfig = <T>(path: string, fallback?: T): T => {
  const keys = path.split('.');
  let value: any = config;
  
  for (const key of keys) {
    value = value?.[key];
    if (value === undefined) {
      return fallback as T;
    }
  }
  
  return value as T;
};