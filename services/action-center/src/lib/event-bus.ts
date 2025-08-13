import IORedis from 'ioredis';
import { logger } from './logger';

export class EventBus {
  private redis: IORedis;
  private consumerGroup: string;
  private consumerName: string;
  private processing: boolean = false;

  constructor() {
    this.redis = new IORedis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0')
    });
    
    this.consumerGroup = process.env.CONSUMER_GROUP || 'action-center-group';
    this.consumerName = process.env.CONSUMER_NAME || 'action-worker-1';
  }

  async initialize(): Promise<void> {
    // Test connection
    await this.redis.ping();
    logger.info('Event bus initialized');
  }

  async subscribe(
    streamName: string,
    consumerGroup: string,
    consumerName: string,
    handler: (event: any) => Promise<void>
  ): Promise<void> {
    this.processing = true;
    
    // Create consumer group if not exists
    try {
      await this.redis.xgroup('CREATE', streamName, consumerGroup, '0', 'MKSTREAM');
    } catch (error: any) {
      if (!error.message.includes('BUSYGROUP')) {
        throw error;
      }
    }
    
    logger.info(`Subscribed to stream ${streamName} as ${consumerName}`);
    
    // Start consuming
    while (this.processing) {
      try {
        const messages = await this.redis.xreadgroup(
          'GROUP',
          consumerGroup,
          consumerName,
          'BLOCK',
          5000,
          'COUNT',
          10,
          'STREAMS',
          streamName,
          '>'
        );
        
        if (messages) {
          for (const [stream, streamMessages] of messages) {
            for (const [id, fields] of streamMessages) {
              try {
                const event = this.parseEvent(fields);
                await handler(event);
                
                // Acknowledge message
                await this.redis.xack(streamName, consumerGroup, id);
              } catch (error) {
                logger.error(`Failed to process message ${id}:`, error);
              }
            }
          }
        }
      } catch (error) {
        logger.error('Error reading from stream:', error);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  async publish(streamName: string, event: any): Promise<string> {
    const fields = this.serializeEvent(event);
    const id = await this.redis.xadd(streamName, '*', ...fields);
    return id;
  }

  private parseEvent(fields: string[]): any {
    const event: any = {};
    
    for (let i = 0; i < fields.length; i += 2) {
      const key = fields[i];
      const value = fields[i + 1];
      
      try {
        event[key] = JSON.parse(value);
      } catch {
        event[key] = value;
      }
    }
    
    return event;
  }

  private serializeEvent(event: any): string[] {
    const fields: string[] = [];
    
    for (const [key, value] of Object.entries(event)) {
      fields.push(key);
      fields.push(typeof value === 'string' ? value : JSON.stringify(value));
    }
    
    return fields;
  }

  async close(): Promise<void> {
    this.processing = false;
    await this.redis.quit();
  }
}