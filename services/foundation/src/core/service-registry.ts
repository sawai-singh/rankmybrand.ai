import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';

export interface Service {
  id?: string;
  name: string;
  host: string;
  port: number;
  healthEndpoint?: string;
  status?: 'healthy' | 'unhealthy' | 'unknown';
  lastHeartbeat?: Date;
  metadata?: Record<string, any>;
}

export class ServiceRegistry {
  private pool: Pool;
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();
  
  constructor(poolConfig?: {
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    max?: number;
  }) {
    this.pool = new Pool({
      host: poolConfig?.host || process.env.DB_HOST || 'localhost',
      port: poolConfig?.port || parseInt(process.env.DB_PORT || '5432'),
      database: poolConfig?.database || process.env.DB_NAME || 'rankmybrand',
      user: poolConfig?.user || process.env.DB_USER || 'postgres',
      password: poolConfig?.password || process.env.DB_PASSWORD,
      max: poolConfig?.max || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      logger.error('ServiceRegistry pool error:', err);
    });

    this.pool.on('connect', () => {
      logger.debug('ServiceRegistry connected to PostgreSQL');
    });

    // Start health check monitor
    this.startHealthMonitor();
  }

  async register(service: Service): Promise<string> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO services (name, host, port, health_endpoint, status, last_heartbeat, metadata)
        VALUES ($1, $2, $3, $4, $5, NOW(), $6)
        ON CONFLICT (name) 
        DO UPDATE SET 
          host = EXCLUDED.host,
          port = EXCLUDED.port,
          health_endpoint = EXCLUDED.health_endpoint,
          status = EXCLUDED.status,
          last_heartbeat = NOW(),
          metadata = EXCLUDED.metadata
        RETURNING id
      `;
      
      const result = await client.query(query, [
        service.name,
        service.host,
        service.port,
        service.healthEndpoint || '/health',
        service.status || 'healthy',
        JSON.stringify(service.metadata || {})
      ]);
      
      const serviceId = result.rows[0].id;
      
      logger.info(`Service registered: ${service.name}`, {
        serviceId,
        host: service.host,
        port: service.port
      });

      // Start automatic heartbeat for this service
      this.startHeartbeat(service.name);
      
      return serviceId;
    } catch (error) {
      logger.error(`Failed to register service ${service.name}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  async deregister(serviceName: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(
        'UPDATE services SET status = $1 WHERE name = $2',
        ['unhealthy', serviceName]
      );
      
      // Stop heartbeat
      this.stopHeartbeat(serviceName);
      
      logger.info(`Service deregistered: ${serviceName}`);
    } catch (error) {
      logger.error(`Failed to deregister service ${serviceName}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  async heartbeat(serviceName: string): Promise<void> {
    try {
      await this.pool.query(
        'UPDATE services SET last_heartbeat = NOW(), status = $1 WHERE name = $2',
        ['healthy', serviceName]
      );
      
      logger.debug(`Heartbeat sent for service: ${serviceName}`);
    } catch (error) {
      logger.error(`Failed to send heartbeat for ${serviceName}:`, error);
      throw error;
    }
  }

  private startHeartbeat(serviceName: string): void {
    // Stop existing heartbeat if any
    this.stopHeartbeat(serviceName);
    
    const interval = parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000');
    
    const heartbeatTimer = setInterval(async () => {
      try {
        await this.heartbeat(serviceName);
      } catch (error) {
        logger.error(`Heartbeat failed for ${serviceName}:`, error);
      }
    }, interval);
    
    this.heartbeatIntervals.set(serviceName, heartbeatTimer);
  }

  private stopHeartbeat(serviceName: string): void {
    const timer = this.heartbeatIntervals.get(serviceName);
    if (timer) {
      clearInterval(timer);
      this.heartbeatIntervals.delete(serviceName);
    }
  }

  async discover(serviceName: string): Promise<Service | null> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        `SELECT * FROM services 
         WHERE name = $1 AND status = $2 
         AND last_heartbeat > NOW() - INTERVAL '1 minute'`,
        [serviceName, 'healthy']
      );
      
      if (result.rows.length === 0) {
        logger.warn(`Service ${serviceName} not found or unhealthy`);
        return null;
      }
      
      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        host: row.host,
        port: row.port,
        healthEndpoint: row.health_endpoint,
        status: row.status,
        lastHeartbeat: row.last_heartbeat,
        metadata: row.metadata
      };
    } catch (error) {
      logger.error(`Failed to discover service ${serviceName}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  async discoverAll(status?: 'healthy' | 'unhealthy' | 'unknown'): Promise<Service[]> {
    const client = await this.pool.connect();
    
    try {
      let query = 'SELECT * FROM services';
      const params: any[] = [];
      
      if (status) {
        query += ' WHERE status = $1';
        params.push(status);
      }
      
      query += ' ORDER BY name';
      
      const result = await client.query(query, params);
      
      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        host: row.host,
        port: row.port,
        healthEndpoint: row.health_endpoint,
        status: row.status,
        lastHeartbeat: row.last_heartbeat,
        metadata: row.metadata
      }));
    } catch (error) {
      logger.error('Failed to discover all services:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getServiceUrl(serviceName: string): Promise<string | null> {
    const service = await this.discover(serviceName);
    
    if (!service) {
      return null;
    }
    
    return `http://${service.host}:${service.port}`;
  }

  private async startHealthMonitor(): Promise<void> {
    const interval = parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000');
    
    setInterval(async () => {
      try {
        // Mark services as unhealthy if no heartbeat for 2 minutes
        await this.pool.query(`
          UPDATE services 
          SET status = 'unhealthy' 
          WHERE last_heartbeat < NOW() - INTERVAL '2 minutes' 
          AND status = 'healthy'
        `);
        
        // Clean up old unhealthy services (older than 24 hours)
        await this.pool.query(`
          DELETE FROM services 
          WHERE status = 'unhealthy' 
          AND last_heartbeat < NOW() - INTERVAL '24 hours'
        `);
      } catch (error) {
        logger.error('Health monitor error:', error);
      }
    }, interval);
  }

  async updateMetadata(serviceName: string, metadata: Record<string, any>): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(
        'UPDATE services SET metadata = $1 WHERE name = $2',
        [JSON.stringify(metadata), serviceName]
      );
      
      logger.debug(`Updated metadata for service: ${serviceName}`);
    } catch (error) {
      logger.error(`Failed to update metadata for ${serviceName}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getMetrics(): Promise<Record<string, any>> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'healthy') as healthy,
          COUNT(*) FILTER (WHERE status = 'unhealthy') as unhealthy,
          COUNT(*) FILTER (WHERE status = 'unknown') as unknown
        FROM services
      `);
      
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get service metrics:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async disconnect(): Promise<void> {
    // Stop all heartbeats
    for (const [name, timer] of this.heartbeatIntervals) {
      clearInterval(timer);
    }
    this.heartbeatIntervals.clear();
    
    // Close pool
    await this.pool.end();
    logger.info('ServiceRegistry disconnected from PostgreSQL');
  }
}