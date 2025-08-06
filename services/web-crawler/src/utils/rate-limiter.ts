/**
 * Rate Limiter
 * Token bucket algorithm for rate limiting
 */

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second

  constructor(tokensPerSecond: number) {
    this.maxTokens = tokensPerSecond;
    this.refillRate = tokensPerSecond;
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * Acquire a token, waiting if necessary
   */
  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Calculate wait time
    const tokensNeeded = 1 - this.tokens;
    const waitTime = (tokensNeeded / this.refillRate) * 1000;

    await this.sleep(waitTime);
    this.refill();
    this.tokens -= 1;
  }

  /**
   * Check if a token is available without acquiring
   */
  canAcquire(): boolean {
    this.refill();
    return this.tokens >= 1;
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // seconds
    const tokensToAdd = elapsed * this.refillRate;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}