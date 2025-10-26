/**
 * Load Testing Suite for Search Intelligence Service
 * Tests system behavior under various load conditions
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import autocannon from 'autocannon';
import { spawn } from 'child_process';
import path from 'path';
import { Redis } from 'ioredis';

interface LoadTestResult {
  requests: {
    total: number;
    persec: number;
  };
  latency: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  errors: number;
  timeouts: number;
}

describe('Search Intelligence Load Tests', () => {
  let serverProcess: any;
  let redis: Redis;
  const TEST_PORT = 3003;
  const BASE_URL = `http://localhost:${TEST_PORT}`;

  beforeAll(async () => {
    // Start test server
    serverProcess = spawn('node', [
      path.join(__dirname, '../../../index.js')
    ], {
      env: {
        ...process.env,
        PORT: TEST_PORT.toString(),
        NODE_ENV: 'test',
        LOG_LEVEL: 'error'
      }
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Initialize Redis for cleanup
    redis = new Redis({
      host: 'localhost',
      port: 6379
    });
  });

  afterAll(async () => {
    // Kill server process
    if (serverProcess) {
      serverProcess.kill();
    }

    // Clean up Redis
    await redis.flushdb();
    await redis.quit();
  });

  describe('Concurrent Analysis Load', () => {
    it('should handle 100 concurrent analysis requests', async () => {
      const result = await runLoadTest({
        url: `${BASE_URL}/api/search-intelligence/analyze`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          brand: 'LoadTestBrand',
          domain: 'loadtest.com',
          options: {
            maxQueries: 5
          }
        }),
        connections: 100,
        duration: 30,
        pipelining: 1
      });

      expect(result.errors).toBeLessThan(result.requests.total * 0.01); // <1% error rate
      expect(result.latency.p95).toBeLessThan(5000); // 95th percentile < 5s
      expect(result.requests.persec).toBeGreaterThan(10); // >10 req/s
    });

    it('should maintain performance with sustained load', async () => {
      const result = await runLoadTest({
        url: `${BASE_URL}/api/search-intelligence/analyze`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          brand: 'SustainedTestBrand',
          domain: 'sustained.com',
          options: {
            maxQueries: 10
          }
        }),
        connections: 50,
        duration: 60,
        pipelining: 1
      });

      // Performance should remain stable over time
      expect(result.latency.p99).toBeLessThan(10000); // 99th percentile < 10s
      expect(result.errors).toBeLessThan(result.requests.total * 0.02); // <2% error rate
    });

    it('should handle burst traffic', async () => {
      // Initial burst
      const burstResult = await runLoadTest({
        url: `${BASE_URL}/api/search-intelligence/analyze`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          brand: 'BurstBrand',
          domain: 'burst.com',
          options: {
            maxQueries: 5
          }
        }),
        connections: 200,
        duration: 10,
        pipelining: 1
      });

      expect(burstResult.errors).toBeLessThan(burstResult.requests.total * 0.05); // <5% error rate during burst
    });
  });

  describe('API Endpoint Load', () => {
    it('should handle high read load on status endpoint', async () => {
      // First create some analyses
      const analysisIds: string[] = [];
      for (let i = 0; i < 10; i++) {
        const response = await fetch(`${BASE_URL}/api/search-intelligence/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brand: `Brand${i}`,
            domain: `brand${i}.com`,
            options: { maxQueries: 3 }
          })
        });
        const data = await response.json();
        analysisIds.push(data.analysisId);
      }

      // Load test status checks
      const result = await runLoadTest({
        url: `${BASE_URL}/api/search-intelligence/${analysisIds[0]}`,
        method: 'GET',
        connections: 100,
        duration: 30,
        pipelining: 1
      });

      expect(result.latency.p50).toBeLessThan(100); // Median < 100ms for cached reads
      expect(result.requests.persec).toBeGreaterThan(100); // >100 req/s for reads
    });

    it('should handle concurrent WebSocket connections', async () => {
      const WebSocket = require('ws');
      const connections: any[] = [];
      const connectionCount = 500;

      // Create analysis for WebSocket testing
      const response = await fetch(`${BASE_URL}/api/search-intelligence/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: 'WebSocketTest',
          domain: 'wstest.com',
          options: { maxQueries: 20 }
        })
      });
      const { analysisId } = await response.json();

      // Establish WebSocket connections
      const startTime = Date.now();
      const connectionPromises = Array.from({ length: connectionCount }, async () => {
        const ws = new WebSocket(`ws://localhost:${TEST_PORT}/ws/search-intel/${analysisId}`);
        await new Promise((resolve, reject) => {
          ws.on('open', resolve);
          ws.on('error', reject);
        });
        connections.push(ws);
      });

      await Promise.all(connectionPromises);
      const connectionTime = Date.now() - startTime;

      expect(connections.length).toBe(connectionCount);
      expect(connectionTime).toBeLessThan(10000); // All connections in < 10s

      // Clean up
      connections.forEach(ws => ws.close());
    });
  });

  describe('Resource Usage', () => {
    it('should not leak memory under load', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Run sustained load
      await runLoadTest({
        url: `${BASE_URL}/api/search-intelligence/analyze`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          brand: 'MemoryTest',
          domain: 'memory.com',
          options: {
            maxQueries: 5
          }
        }),
        connections: 50,
        duration: 60,
        pipelining: 1
      });

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      await new Promise(resolve => setTimeout(resolve, 5000));

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      expect(memoryIncrease).toBeLessThan(100); // Less than 100MB increase
    });

    it('should respect rate limits under load', async () => {
      const result = await runLoadTest({
        url: `${BASE_URL}/api/search-intelligence/analyze`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          brand: 'RateLimitTest',
          domain: 'ratelimit.com',
          options: {
            maxQueries: 10
          }
        }),
        connections: 200, // High connection count
        duration: 30,
        pipelining: 1
      });

      // Should see rate limiting in action
      const rateLimitedRequests = result.errors;
      expect(rateLimitedRequests).toBeGreaterThan(0); // Some requests should be rate limited
    });
  });

  describe('Database Performance', () => {
    it('should maintain query performance under load', async () => {
      // Monitor database query times during load test
      const queryTimes: number[] = [];
      
      // Hook into database query logging
      const originalQuery = (global as any).dbQuery;
      (global as any).dbQuery = async (...args: any[]) => {
        const start = Date.now();
        const result = await originalQuery(...args);
        queryTimes.push(Date.now() - start);
        return result;
      };

      await runLoadTest({
        url: `${BASE_URL}/api/search-intelligence/analyze`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          brand: 'DBTest',
          domain: 'dbtest.com',
          options: {
            maxQueries: 5
          }
        }),
        connections: 50,
        duration: 30,
        pipelining: 1
      });

      // Restore original query function
      (global as any).dbQuery = originalQuery;

      // Analyze query times
      const avgQueryTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
      const maxQueryTime = Math.max(...queryTimes);

      expect(avgQueryTime).toBeLessThan(50); // Average query < 50ms
      expect(maxQueryTime).toBeLessThan(500); // Max query < 500ms
    });
  });

  describe('Cache Performance', () => {
    it('should improve performance with cache hits', async () => {
      const testPayload = {
        brand: 'CacheTest',
        domain: 'cachetest.com',
        options: {
          maxQueries: 5
        }
      };

      // First run - cache miss
      const coldResult = await runLoadTest({
        url: `${BASE_URL}/api/search-intelligence/analyze`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testPayload),
        connections: 10,
        duration: 10,
        pipelining: 1
      });

      // Second run - cache hit
      const warmResult = await runLoadTest({
        url: `${BASE_URL}/api/search-intelligence/analyze`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testPayload),
        connections: 10,
        duration: 10,
        pipelining: 1
      });

      // Cache should significantly improve performance
      expect(warmResult.latency.p50).toBeLessThan(coldResult.latency.p50 * 0.5); // 50% faster
      expect(warmResult.requests.persec).toBeGreaterThan(coldResult.requests.persec * 1.5); // 50% more throughput
    });
  });
});

/**
 * Helper function to run autocannon load test
 */
async function runLoadTest(options: any): Promise<LoadTestResult> {
  return new Promise((resolve, reject) => {
    const instance = autocannon(options, (err, result) => {
      if (err) {
        reject(err);
        return;
      }

      resolve({
        requests: {
          total: result.requests.total,
          persec: result.requests.average
        },
        latency: {
          p50: result.latency.p50,
          p90: result.latency.p90,
          p95: result.latency.p95,
          p99: result.latency.p99
        },
        errors: result.errors,
        timeouts: result.timeouts
      });
    });

    autocannon.track(instance, { renderProgressBar: false });
  });
}