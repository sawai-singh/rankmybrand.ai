// Test setup file
import { jest } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

// Mock external services
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    zadd: jest.fn(),
    zrem: jest.fn(),
    zrevrange: jest.fn(),
    zcard: jest.fn(),
    sadd: jest.fn(),
    srem: jest.fn(),
    smembers: jest.fn(),
    sismember: jest.fn(),
    hset: jest.fn(),
    hget: jest.fn(),
    hgetall: jest.fn(),
    expire: jest.fn(),
    quit: jest.fn(),
    status: 'ready'
  }));
});

// Mock database pool
jest.mock('../src/db/index.js', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn().mockResolvedValue({
      query: jest.fn(),
      release: jest.fn()
    }),
    end: jest.fn()
  },
  query: jest.fn(),
  withTransaction: jest.fn(),
  testConnection: jest.fn().mockResolvedValue(true),
  close: jest.fn()
}));

// Global test timeout
jest.setTimeout(30000);

// Suppress console during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};
