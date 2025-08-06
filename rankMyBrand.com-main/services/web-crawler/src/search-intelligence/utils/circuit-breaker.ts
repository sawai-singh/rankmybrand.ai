/**
 * Circuit Breaker
 * Prevents cascading failures by stopping requests to failing services
 */

import { EventEmitter } from 'events';
import { Logger } from './logger.js';
import { CircuitBreakerState } from '../types/serp-client.types.js';

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  successThreshold: number; // Number of successes to close from half-open
  timeout: number; // Milliseconds before trying half-open
  volumeThreshold: number; // Minimum requests before evaluating
  errorFilter?: (error: any) => boolean; // Which errors count as failures
}

export class CircuitBreaker extends EventEmitter {
  private logger: Logger;
  private config: CircuitBreakerConfig;
  private state: 'closed' | 'open' | 'half-open';
  private failures: number;
  private successes: number;
  private requests: number;
  private lastFailureTime?: Date;
  private nextRetryTime?: Date;
  private stateChangeCallbacks: Array<(state: CircuitBreakerState) => void> = [];

  constructor(
    name: string,
    config: Partial<CircuitBreakerConfig> = {}
  ) {
    super();
    this.logger = new Logger(`CircuitBreaker:${name}`);
    this.config = {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000, // 1 minute
      volumeThreshold: 10,
      ...config
    };
    
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.requests = 0;
    
    this.logger.info(`Circuit breaker initialized: ${JSON.stringify(this.config)}`);
  }

  /**
   * Execute a function through the circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === 'open') {
      if (this.canRetry()) {
        this.transitionTo('half-open');
      } else {
        const error = new Error(`Circuit breaker is OPEN. Next retry at ${this.nextRetryTime?.toISOString()}`);
        (error as any).circuitBreakerOpen = true;
        throw error;
      }
    }
    
    this.requests++;
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.failures = 0;
    
    if (this.state === 'half-open') {
      this.successes++;
      this.logger.info(`Success in half-open state (${this.successes}/${this.config.successThreshold})`);
      
      if (this.successes >= this.config.successThreshold) {
        this.transitionTo('closed');
      }
    }
    
    this.emit('success', { state: this.state });
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: any): void {
    // Check if this error should count as a failure
    if (this.config.errorFilter && !this.config.errorFilter(error)) {
      this.logger.debug('Error filtered out, not counting as failure');
      return;
    }
    
    this.failures++;
    this.lastFailureTime = new Date();
    
    this.logger.warn(`Failure ${this.failures}/${this.config.failureThreshold}: ${error.message}`);
    
    if (this.state === 'half-open') {
      this.transitionTo('open');
    } else if (
      this.state === 'closed' &&
      this.requests >= this.config.volumeThreshold &&
      this.failures >= this.config.failureThreshold
    ) {
      this.transitionTo('open');
    }
    
    this.emit('failure', { state: this.state, error });
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: 'closed' | 'open' | 'half-open'): void {
    const oldState = this.state;
    this.state = newState;
    
    this.logger.info(`State transition: ${oldState} -> ${newState}`);
    
    switch (newState) {
      case 'open':
        this.nextRetryTime = new Date(Date.now() + this.config.timeout);
        this.successes = 0;
        this.emit('open', { nextRetryTime: this.nextRetryTime });
        break;
        
      case 'half-open':
        this.successes = 0;
        this.failures = 0;
        this.emit('half-open');
        break;
        
      case 'closed':
        this.failures = 0;
        this.successes = 0;
        this.requests = 0;
        this.nextRetryTime = undefined;
        this.emit('closed');
        break;
    }
    
    // Notify state change callbacks
    const state = this.getState();
    this.stateChangeCallbacks.forEach(callback => {
      try {
        callback(state);
      } catch (error) {
        this.logger.error('State change callback error:', error);
      }
    });
  }

  /**
   * Check if we can retry (for open state)
   */
  private canRetry(): boolean {
    if (!this.nextRetryTime) return true;
    return Date.now() >= this.nextRetryTime.getTime();
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      nextRetryTime: this.nextRetryTime
    };
  }

  /**
   * Force open the circuit
   */
  open(): void {
    this.transitionTo('open');
  }

  /**
   * Force close the circuit
   */
  close(): void {
    this.transitionTo('closed');
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.close();
    this.failures = 0;
    this.successes = 0;
    this.requests = 0;
    this.lastFailureTime = undefined;
    this.logger.info('Circuit breaker reset');
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(callback: (state: CircuitBreakerState) => void): () => void {
    this.stateChangeCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.stateChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.stateChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get statistics
   */
  getStats(): {
    state: string;
    failures: number;
    successes: number;
    requests: number;
    lastFailureTime?: Date;
    nextRetryTime?: Date;
    uptime: number;
  } {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      requests: this.requests,
      lastFailureTime: this.lastFailureTime,
      nextRetryTime: this.nextRetryTime,
      uptime: this.state === 'closed' ? 
        (this.lastFailureTime ? Date.now() - this.lastFailureTime.getTime() : Infinity) : 0
    };
  }

  /**
   * Health check
   */
  isHealthy(): boolean {
    return this.state === 'closed';
  }

  /**
   * Wrap a function with circuit breaker protection
   */
  wrap<T extends (...args: any[]) => Promise<any>>(fn: T): T {
    return (async (...args: Parameters<T>) => {
      return this.execute(() => fn(...args));
    }) as T;
  }
}

/**
 * Circuit Breaker Factory
 * Manages multiple circuit breakers
 */
export class CircuitBreakerFactory {
  private breakers: Map<string, CircuitBreaker> = new Map();
  private logger: Logger;

  constructor() {
    this.logger = new Logger('CircuitBreakerFactory');
  }

  /**
   * Get or create a circuit breaker
   */
  getBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      const breaker = new CircuitBreaker(name, config);
      this.breakers.set(name, breaker);
      this.logger.info(`Created circuit breaker: ${name}`);
    }
    
    return this.breakers.get(name)!;
  }

  /**
   * Get all circuit breakers
   */
  getAllBreakers(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  /**
   * Get health status of all breakers
   */
  getHealthStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    
    for (const [name, breaker] of this.breakers) {
      status[name] = breaker.isHealthy();
    }
    
    return status;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
    
    this.logger.info('Reset all circuit breakers');
  }

  /**
   * Remove a circuit breaker
   */
  removeBreaker(name: string): void {
    if (this.breakers.delete(name)) {
      this.logger.info(`Removed circuit breaker: ${name}`);
    }
  }

  /**
   * Clear all circuit breakers
   */
  clear(): void {
    this.breakers.clear();
    this.logger.info('Cleared all circuit breakers');
  }
}