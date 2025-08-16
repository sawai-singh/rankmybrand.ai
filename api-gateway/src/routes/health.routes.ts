/**
 * Health Check Routes
 * Provides health status and monitoring endpoints
 */

import { Router, Request, Response } from 'express';
import { db } from '../database/connection';
import Redis from 'ioredis';
import os from 'os';
import fs from 'fs/promises';
import path from 'path';

const router = Router();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Service URLs
const SERVICES = {
  geo: process.env.GEO_SERVICE || 'http://localhost:8002',
  crawler: process.env.CRAWLER_SERVICE || 'http://localhost:3002',
  search: process.env.SEARCH_SERVICE || 'http://localhost:3002',
  intelligence: process.env.INTELLIGENCE_SERVICE || 'http://localhost:8002',
  action: process.env.ACTION_SERVICE || 'http://localhost:8082',
};

// Health status types
type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

interface ServiceHealth {
  status: HealthStatus;
  responseTime?: number;
  error?: string;
  lastChecked: string;
}

interface SystemHealth {
  status: HealthStatus;
  uptime: number;
  timestamp: string;
  version: string;
  environment: string;
  services: Record<string, ServiceHealth>;
  database: ServiceHealth;
  redis: ServiceHealth;
  system: {
    cpu: {
      usage: number;
      cores: number;
    };
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    disk: {
      used: number;
      total: number;
      percentage: number;
    };
  };
}

/**
 * Basic health check
 */
router.get('/', async (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * Detailed health check
 */
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    const health = await getDetailedHealth();
    const statusCode = health.status === 'healthy' ? 200 : 
                       health.status === 'degraded' ? 206 : 503;
    
    res.status(statusCode).json(health);
  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Liveness probe (for K8s)
 */
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({ alive: true });
});

/**
 * Readiness probe (for K8s)
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check critical dependencies
    const [dbHealthy, redisHealthy] = await Promise.all([
      checkDatabase(),
      checkRedis(),
    ]);
    
    if (dbHealthy && redisHealthy) {
      res.status(200).json({ ready: true });
    } else {
      res.status(503).json({ 
        ready: false,
        database: dbHealthy,
        redis: redisHealthy,
      });
    }
  } catch (error) {
    res.status(503).json({ ready: false });
  }
});

/**
 * Service dependencies status
 */
router.get('/services', async (req: Request, res: Response) => {
  const services = await checkAllServices();
  const allHealthy = Object.values(services).every(s => s.status === 'healthy');
  
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'degraded',
    services,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Database health check
 */
router.get('/database', async (req: Request, res: Response) => {
  const dbHealth = await checkDatabaseDetailed();
  const statusCode = dbHealth.status === 'healthy' ? 200 : 503;
  
  res.status(statusCode).json(dbHealth);
});

/**
 * Redis health check
 */
router.get('/redis', async (req: Request, res: Response) => {
  const redisHealth = await checkRedisDetailed();
  const statusCode = redisHealth.status === 'healthy' ? 200 : 503;
  
  res.status(statusCode).json(redisHealth);
});

/**
 * System metrics
 */
router.get('/metrics', async (req: Request, res: Response) => {
  const metrics = await getSystemMetrics();
  res.json(metrics);
});

// Helper functions

async function getDetailedHealth(): Promise<SystemHealth> {
  const [services, database, redisHealth, system] = await Promise.all([
    checkAllServices(),
    checkDatabaseDetailed(),
    checkRedisDetailed(),
    getSystemMetrics(),
  ]);
  
  // Determine overall status
  let overallStatus: HealthStatus = 'healthy';
  
  if (database.status === 'unhealthy' || redisHealth.status === 'unhealthy') {
    overallStatus = 'unhealthy';
  } else if (database.status === 'degraded' || redisHealth.status === 'degraded') {
    overallStatus = 'degraded';
  } else {
    const unhealthyServices = Object.values(services).filter(s => s.status === 'unhealthy').length;
    const degradedServices = Object.values(services).filter(s => s.status === 'degraded').length;
    
    if (unhealthyServices > 2) {
      overallStatus = 'unhealthy';
    } else if (unhealthyServices > 0 || degradedServices > 2) {
      overallStatus = 'degraded';
    }
  }
  
  return {
    status: overallStatus,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    services,
    database,
    redis: redisHealth,
    system,
  };
}

async function checkAllServices(): Promise<Record<string, ServiceHealth>> {
  const serviceChecks = Object.entries(SERVICES).map(async ([name, url]) => {
    const health = await checkService(url);
    return { name, health };
  });
  
  const results = await Promise.all(serviceChecks);
  
  return results.reduce((acc, { name, health }) => {
    acc[name] = health;
    return acc;
  }, {} as Record<string, ServiceHealth>);
}

async function checkService(url: string): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${url}/health`, {
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    const responseTime = Date.now() - startTime;
    
    return {
      status: response.ok ? 'healthy' : 'degraded',
      responseTime,
      lastChecked: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error.message,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkDatabase(): Promise<boolean> {
  try {
    const result = await db.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

async function checkDatabaseDetailed(): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    // Check basic connectivity
    await db.query('SELECT 1');
    
    // Get connection pool stats
    const status = db.getStatus();
    
    // Check if pool is healthy
    const responseTime = Date.now() - startTime;
    let healthStatus: HealthStatus = 'healthy';
    
    if (!status.connected) {
      healthStatus = 'unhealthy';
    } else if (status.stats.waiting > 10) {
      healthStatus = 'degraded';
    }
    
    return {
      status: healthStatus,
      responseTime,
      lastChecked: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error.message,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkRedis(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

async function checkRedisDetailed(): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    const pong = await redis.ping();
    const responseTime = Date.now() - startTime;
    
    if (pong !== 'PONG') {
      return {
        status: 'unhealthy',
        responseTime,
        error: 'Invalid ping response',
        lastChecked: new Date().toISOString(),
      };
    }
    
    // Check response time
    let status: HealthStatus = 'healthy';
    if (responseTime > 100) {
      status = 'degraded';
    }
    
    return {
      status,
      responseTime,
      lastChecked: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error.message,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function getSystemMetrics() {
  const cpus = os.cpus();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  
  // Calculate CPU usage
  const cpuUsage = cpus.reduce((acc, cpu) => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
    const idle = cpu.times.idle;
    return acc + ((total - idle) / total);
  }, 0) / cpus.length;
  
  // Get disk usage (simplified - just check current directory)
  let diskUsage = { used: 0, total: 0, percentage: 0 };
  try {
    const stats = await fs.statfs(path.resolve('.'));
    const total = stats.blocks * stats.bsize;
    const available = stats.bavail * stats.bsize;
    const used = total - available;
    
    diskUsage = {
      used,
      total,
      percentage: (used / total) * 100,
    };
  } catch (error) {
    // Fallback if statfs is not available
  }
  
  return {
    cpu: {
      usage: Math.round(cpuUsage * 100),
      cores: cpus.length,
    },
    memory: {
      used: usedMemory,
      total: totalMemory,
      percentage: Math.round((usedMemory / totalMemory) * 100),
    },
    disk: diskUsage,
  };
}

export default router;