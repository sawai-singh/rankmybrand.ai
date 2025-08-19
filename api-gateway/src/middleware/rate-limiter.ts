import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';

const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

interface RateLimiterOptions {
  windowMs?: number;
  max?: number;
  message?: string;
  keyGenerator?: (req: any) => string;
}

export const rateLimiter = (options: RateLimiterOptions = {}) => {
  const {
    windowMs = 60 * 1000, // 1 minute
    max = 100, // 100 requests per window
    message = 'Too many requests from this IP, please try again later.',
    keyGenerator
  } = options;

  return rateLimit({
    store: new RedisStore({
      client: redisClient,
      prefix: 'rate-limit:',
    }),
    windowMs,
    max,
    message,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyGenerator || ((req) => {
      return req.user?.id || req.ip;
    }),
  });
};