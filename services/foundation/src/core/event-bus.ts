import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export interface Event {
  type: string;
  data: unknown;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface StreamMessage {
  id: string;
  event_type: string;
  data: unknown;
  timestamp: string;
  correlation_id: string;
  metadata?: Record<string, unknown>;
}

export class EventBus {
  private redis: Redis;
  private subscriberRedis: Redis;
  private consumerGroups: Map<string, Set<string>> = new Map();
  
  constructor(redisConfig?: {
    host?: string;
    port?: number;
    password?: string;
  }) {
    const config = {
      host: redisConfig?.host || process.env.REDIS_HOST || 'localhost',
      port: redisConfig?.port || parseInt(process.env.REDIS_PORT || '6379'),
      password: redisConfig?.password || process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
      enableReadyCheck: true,
      lazyConnect: false,
    };

    this.redis = new Redis(config);
    this.subscriberRedis = new Redis(config);

    this.redis.on('connect', () => {
      logger.info('EventBus connected to Redis');
    });

    this.redis.on('error', (err) => {
      logger.error('EventBus Redis error:', err);
    });
  }

  async publish(stream: string, event: Event): Promise<string> {
    try {
      const messageId = await this.redis.xadd(
        stream,
        'MAXLEN', '~', '100000',  // Keep approximately 100K messages
        '*',  // Auto-generate ID
        'event_type', event.type,
        'data', JSON.stringify(event.data),
        'timestamp', Date.now().toString(),
        'correlation_id', event.correlationId || uuidv4(),
        'metadata', JSON.stringify(event.metadata || {})
      );
      
      // Update metrics
      await this.redis.hincrby('metrics:events:published', stream, 1);
      
      logger.debug(`Published event to ${stream}: ${event.type}`, {
        messageId,
        correlationId: event.correlationId
      });
      
      return messageId || '';
    } catch (error) {
      logger.error(`Failed to publish event to ${stream}:`, error);
      throw error;
    }
  }

  async subscribe(
    stream: string,
    group: string,
    consumer: string,
    handler: (event: StreamMessage) => Promise<void>,
    options: {
      blockMs?: number;
      count?: number;
      retryDelay?: number;
    } = {}
  ): Promise<void> {
    const { blockMs = 1000, count = 10, retryDelay = 5000 } = options;

    // Create consumer group if not exists
    await this.ensureConsumerGroup(stream, group);

    // Track consumer group
    if (!this.consumerGroups.has(stream)) {
      this.consumerGroups.set(stream, new Set());
    }
    this.consumerGroups.get(stream)!.add(group);

    logger.info(`Starting consumer ${consumer} for group ${group} on stream ${stream}`);

    // Start consuming messages
    this.consumeMessages(stream, group, consumer, handler, { blockMs, count, retryDelay });
  }

  private async ensureConsumerGroup(stream: string, group: string): Promise<void> {
    try {
      await this.redis.xgroup('CREATE', stream, group, '$', 'MKSTREAM');
      logger.info(`Created consumer group ${group} for stream ${stream}`);
    } catch (err) {
      const error = err as Error;
      if (error.message && error.message.includes('BUSYGROUP')) {
        logger.debug(`Consumer group ${group} already exists for stream ${stream}`);
      } else {
        logger.error(`Failed to create consumer group ${group}:`, err);
        throw err;
      }
    }
  }

  private async consumeMessages(
    stream: string,
    group: string,
    consumer: string,
    handler: (event: StreamMessage) => Promise<void>,
    options: {
      blockMs: number;
      count: number;
      retryDelay: number;
    }
  ): Promise<void> {
    while (true) {
      try {
        // Read pending messages first
        const pendingMessages = await this.redis.xreadgroup(
          'GROUP', group, consumer,
          'COUNT', options.count.toString(),
          'STREAMS', stream, '0'
        );

        if (pendingMessages && pendingMessages.length > 0) {
          await this.processMessages(pendingMessages as Array<[string, Array<[string, string[]]>]>, stream, group, handler);
        }

        // Read new messages
        const messages = await this.redis.xreadgroup(
          'GROUP', group, consumer,
          'COUNT', options.count.toString(),
          'BLOCK', options.blockMs.toString(),
          'STREAMS', stream, '>'
        );

        if (messages && messages.length > 0) {
          await this.processMessages(messages as Array<[string, Array<[string, string[]]>]>, stream, group, handler);
        }
      } catch (error) {
        logger.error(`Error consuming messages from ${stream}:`, error);
        await this.delay(options.retryDelay);
      }
    }
  }

  private async processMessages(
    messages: Array<[string, Array<[string, string[]]>]>,
    stream: string,
    group: string,
    handler: (event: StreamMessage) => Promise<void>
  ): Promise<void> {
    for (const [, streamMessages] of messages) {
      for (const message of streamMessages) {
        const [id, fields] = message;
        const event = this.parseMessage(id, fields);

        try {
          await handler(event);
          
          // Acknowledge message
          await this.redis.xack(stream, group, id);
          
          // Update metrics
          await this.redis.hincrby('metrics:events:consumed', stream, 1);
          
          logger.debug(`Processed message ${id} from ${stream}`);
        } catch (error) {
          logger.error(`Error processing message ${id}:`, error);
          
          // Update error metrics
          await this.redis.hincrby('metrics:events:errors', stream, 1);
          
          // Message will be retried on next read
        }
      }
    }
  }

  private parseMessage(id: string, fields: string[]): StreamMessage {
    const result: Record<string, unknown> = { id };
    
    for (let i = 0; i < fields.length; i += 2) {
      const key = fields[i];
      const value = fields[i + 1];
      
      if (key === 'data' || key === 'metadata') {
        try {
          result[key] = JSON.parse(value);
        } catch {
          result[key] = value;
        }
      } else {
        result[key] = value;
      }
    }
    
    return result as unknown as StreamMessage;
  }

  async getStreamInfo(stream: string): Promise<Record<string, unknown> | null> {
    try {
      const info = await this.redis.xinfo('STREAM', stream);
      const groups = await this.redis.xinfo('GROUPS', stream);
      
      return {
        stream: info,
        groups: groups
      };
    } catch (error) {
      logger.error(`Failed to get stream info for ${stream}:`, error);
      return null;
    }
  }

  async getMetrics(): Promise<Record<string, unknown>> {
    const published = await this.redis.hgetall('metrics:events:published');
    const consumed = await this.redis.hgetall('metrics:events:consumed');
    const errors = await this.redis.hgetall('metrics:events:errors');
    
    return {
      published,
      consumed,
      errors
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
    await this.subscriberRedis.quit();
    logger.info('EventBus disconnected from Redis');
  }
}