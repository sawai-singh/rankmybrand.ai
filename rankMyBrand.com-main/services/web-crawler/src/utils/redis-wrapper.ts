import Redis from 'ioredis';

/**
 * Redis wrapper to ensure compatibility across different ioredis versions
 */
export class RedisWrapper {
  private client: Redis;

  constructor(client: Redis) {
    this.client = client;
  }

  // Sorted set operations
  async zadd(key: string, ...args: any[]): Promise<number> {
    return this.client.zadd(key, ...args);
  }

  async zrangebyscore(key: string, min: string | number, max: string | number, ...args: any[]): Promise<string[]> {
    return this.client.zrangebyscore(key, min, max, ...args);
  }

  async zrevrange(key: string, start: number, stop: number, withscores?: 'WITHSCORES'): Promise<string[]> {
    if (withscores) {
      return this.client.zrevrange(key, start, stop, withscores);
    }
    return this.client.zrevrange(key, start, stop);
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    return this.client.zrem(key, ...members);
  }

  async zcard(key: string): Promise<number> {
    return this.client.zcard(key);
  }

  // String operations
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ...args: any[]): Promise<string> {
    return this.client.set(key, value, ...args);
  }

  // Hash operations
  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    return this.client.hset(key, field, value);
  }

  // Set operations
  async sadd(key: string, ...members: string[]): Promise<number> {
    return this.client.sadd(key, ...members);
  }

  async smembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }

  async sismember(key: string, member: string): Promise<number> {
    return this.client.sismember(key, member);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    return this.client.srem(key, ...members);
  }

  // Key operations
  async del(...keys: string[]): Promise<number> {
    return this.client.del(...keys);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.client.expire(key, seconds);
  }

  // Raw client access for other operations
  getClient(): Redis {
    return this.client;
  }
}