import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

interface Config {
  // Server
  PORT: number;
  HOST: string;
  NODE_ENV: string;
  
  // Database
  DATABASE_URL: string;
  DATABASE_POOL_MIN: number;
  DATABASE_POOL_MAX: number;
  
  // Redis
  REDIS_URL: string;
  REDIS_PASSWORD: string;
  REDIS_DB: number;
  
  // Crawler
  MAX_CONCURRENT_CRAWLS: number;
  MAX_PAGES_PER_CRAWL: number;
  DEFAULT_CRAWL_DEPTH: number;
  RATE_LIMIT_PER_SECOND: number;
  JS_RENDERING_BUDGET: number;
  CRAWL_TIMEOUT_MS: number;
  RETRY_ATTEMPTS: number;
  USER_AGENT: string;
  
  // Browser
  JS_RENDERING_ENABLED: boolean;
  BROWSER_HEADLESS: boolean;
  BROWSER_TIMEOUT: number;
  MAX_BROWSER_CONTEXTS: number;
  BROWSER_CONTEXT_TTL_MINUTES: number;
  
  // Cache
  ROBOTS_CACHE_TTL_HOURS: number;
  CRAWL_RESULTS_TTL_DAYS: number;
  GEO_METRICS_CACHE_TTL_HOURS: number;
  
  // API
  API_KEY_HEADER: string;
  ALLOWED_ORIGINS: string[];
  RATE_LIMIT_MAX: number;
  RATE_LIMIT_WINDOW_MS: number;
  
  // Monitoring
  ENABLE_METRICS: boolean;
  METRICS_PORT: number;
  LOG_LEVEL: string;
  LOG_FORMAT: string;
  
  // Cost Control
  MAX_COST_PER_CRAWL: number;
  ALERT_COST_THRESHOLD: number;
  
  // External Services
  GEO_CALCULATOR_URL: string;
  GEO_CALCULATOR_API_KEY: string;
  
  // Feature Flags
  ENABLE_SITEMAP_DISCOVERY: boolean;
  ENABLE_REAL_TIME_UPDATES: boolean;
  ENABLE_RECOMMENDATIONS: boolean;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  return value ? value.toLowerCase() === 'true' : defaultValue;
}

function getEnvArray(key: string, defaultValue: string[]): string[] {
  const value = process.env[key];
  return value ? value.split(',').map(s => s.trim()) : defaultValue;
}

export const config: Config = {
  // Server
  PORT: getEnvNumber('PORT', 3002),
  HOST: process.env.HOST || '0.0.0.0',
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Database
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://rankmybrand:password@localhost:5432/rankmybrand_crawler',
  DATABASE_POOL_MIN: getEnvNumber('DATABASE_POOL_MIN', 2),
  DATABASE_POOL_MAX: getEnvNumber('DATABASE_POOL_MAX', 10),
  
  // Redis
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',
  REDIS_DB: getEnvNumber('REDIS_DB', 1),
  
  // Crawler
  MAX_CONCURRENT_CRAWLS: getEnvNumber('MAX_CONCURRENT_CRAWLS', 5),
  MAX_PAGES_PER_CRAWL: getEnvNumber('MAX_PAGES_PER_CRAWL', 500),
  DEFAULT_CRAWL_DEPTH: getEnvNumber('DEFAULT_CRAWL_DEPTH', 3),
  RATE_LIMIT_PER_SECOND: getEnvNumber('RATE_LIMIT_PER_SECOND', 5),
  JS_RENDERING_BUDGET: parseFloat(process.env.JS_RENDERING_BUDGET || '0.1'),
  CRAWL_TIMEOUT_MS: getEnvNumber('CRAWL_TIMEOUT_MS', 10000),
  RETRY_ATTEMPTS: getEnvNumber('RETRY_ATTEMPTS', 3),
  USER_AGENT: 'RankMyBrand-Bot/1.0 (+https://rankmybrand.ai/bot)',
  
  // Browser
  JS_RENDERING_ENABLED: getEnvBoolean('JS_RENDERING_ENABLED', true),
  BROWSER_HEADLESS: getEnvBoolean('BROWSER_HEADLESS', true),
  BROWSER_TIMEOUT: getEnvNumber('BROWSER_TIMEOUT', 15000),
  MAX_BROWSER_CONTEXTS: getEnvNumber('MAX_BROWSER_CONTEXTS', 5),
  BROWSER_CONTEXT_TTL_MINUTES: getEnvNumber('BROWSER_CONTEXT_TTL_MINUTES', 30),
  
  // Cache
  ROBOTS_CACHE_TTL_HOURS: getEnvNumber('ROBOTS_CACHE_TTL_HOURS', 24),
  CRAWL_RESULTS_TTL_DAYS: getEnvNumber('CRAWL_RESULTS_TTL_DAYS', 7),
  GEO_METRICS_CACHE_TTL_HOURS: getEnvNumber('GEO_METRICS_CACHE_TTL_HOURS', 1),
  
  // API
  API_KEY_HEADER: process.env.API_KEY_HEADER || 'x-api-key',
  ALLOWED_ORIGINS: getEnvArray('ALLOWED_ORIGINS', ['http://localhost:3000', 'http://localhost:3001']),
  RATE_LIMIT_MAX: getEnvNumber('RATE_LIMIT_MAX', 100),
  RATE_LIMIT_WINDOW_MS: getEnvNumber('RATE_LIMIT_WINDOW_MS', 60000),
  
  // Monitoring
  ENABLE_METRICS: getEnvBoolean('ENABLE_METRICS', true),
  METRICS_PORT: getEnvNumber('METRICS_PORT', 9091),
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FORMAT: process.env.LOG_FORMAT || 'json',
  
  // Cost Control
  MAX_COST_PER_CRAWL: parseFloat(process.env.MAX_COST_PER_CRAWL || '0.005'),
  ALERT_COST_THRESHOLD: parseFloat(process.env.ALERT_COST_THRESHOLD || '0.004'),
  
  // External Services
  GEO_CALCULATOR_URL: process.env.GEO_CALCULATOR_URL || 'http://localhost:3001/api/calculate',
  GEO_CALCULATOR_API_KEY: process.env.GEO_CALCULATOR_API_KEY || '',
  
  // Feature Flags
  ENABLE_SITEMAP_DISCOVERY: getEnvBoolean('ENABLE_SITEMAP_DISCOVERY', true),
  ENABLE_REAL_TIME_UPDATES: getEnvBoolean('ENABLE_REAL_TIME_UPDATES', true),
  ENABLE_RECOMMENDATIONS: getEnvBoolean('ENABLE_RECOMMENDATIONS', true),
};

// Validate required configuration
const requiredVars = ['DATABASE_URL', 'REDIS_URL'];
const missing = requiredVars.filter(key => !process.env[key]);

if (missing.length > 0 && config.NODE_ENV === 'production') {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

// Log configuration in development
if (config.NODE_ENV === 'development') {
  console.log('Configuration loaded:', {
    NODE_ENV: config.NODE_ENV,
    PORT: config.PORT,
    DATABASE_URL: config.DATABASE_URL.replace(/\/\/[^@]+@/, '//***:***@'), // Hide credentials
    REDIS_URL: config.REDIS_URL.replace(/\/\/[^@]+@/, '//***:***@'),
    MAX_PAGES_PER_CRAWL: config.MAX_PAGES_PER_CRAWL,
    JS_RENDERING_BUDGET: config.JS_RENDERING_BUDGET
  });
}
