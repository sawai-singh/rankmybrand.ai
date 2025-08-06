import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/rankmybrand_crawler'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  
  // Crawler settings
  MAX_CONCURRENT_CRAWLS: z.string().transform(Number).default('5'),
  DEFAULT_TIMEOUT_MS: z.string().transform(Number).default('10000'),
  JS_RENDERING_BUDGET: z.string().transform(Number).default('0.1'),
  DEFAULT_RATE_LIMIT_PER_SECOND: z.string().transform(Number).default('5'),
  
  // Browser settings
  BROWSER_HEADLESS: z.string().transform(val => val === 'true').default('true'),
  BROWSER_POOL_SIZE: z.string().transform(Number).default('3'),
  
  // Storage settings
  MAX_CACHE_SIZE_MB: z.string().transform(Number).default('500'),
  CACHE_TTL_HOURS: z.string().transform(Number).default('24'),
  
  // API settings
  API_KEY_HEADER: z.string().default('X-API-Key'),
  ENABLE_CORS: z.string().transform(val => val === 'true').default('true'),
  
  // Monitoring
  METRICS_ENABLED: z.string().transform(val => val === 'true').default('true'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

// Parse and validate environment variables
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const config = {
  ...parsed.data,
  
  // Derived configurations
  isDevelopment: parsed.data.NODE_ENV === 'development',
  isProduction: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
  
  // Crawler defaults
  crawler: {
    maxPages: 500,
    maxDepth: 3,
    retryAttempts: 3,
    userAgent: 'RankMyBrand-Bot/1.0 (+https://rankmybrand.ai/bot)',
  },
  
  // Rate limiting
  rateLimiting: {
    defaultDelay: 1000 / parsed.data.DEFAULT_RATE_LIMIT_PER_SECOND,
    robotsTxtCacheTTL: 24 * 60 * 60 * 1000, // 24 hours
  },
  
  // Database
  database: {
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    max: 20,
  },
  
  // Redis
  redis: {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
  },
};

export type Config = typeof config;
