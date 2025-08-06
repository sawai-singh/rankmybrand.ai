/**
 * Cost Manager
 * Tracks and manages API costs with budget enforcement
 */

import { Redis } from 'ioredis';
import { Logger } from '../../utils/logger.js';
import {
  CostManagementConfig,
  CostTracker,
  CostStats,
  BudgetAlert,
  SerpApiProvider
} from '../types/serp-client.types.js';

export class CostManager {
  private logger: Logger;
  private redis: Redis;
  private config: CostManagementConfig;
  private namespace: string;
  private tracker: CostTracker;

  constructor(redis: Redis, config: CostManagementConfig, namespace = 'serp:cost') {
    this.logger = new Logger('CostManager');
    this.redis = redis;
    this.config = config;
    this.namespace = namespace;
    this.tracker = {
      currentDailySpend: 0,
      currentMonthlySpend: 0,
      queryCount: new Map(),
      lastReset: {
        daily: new Date(),
        monthly: new Date()
      }
    };
    this.initializeTracker();
  }

  /**
   * Initialize cost tracker from Redis
   */
  private async initializeTracker(): Promise<void> {
    try {
      const data = await this.redis.get(`${this.namespace}:tracker`);
      if (data) {
        const parsed = JSON.parse(data);
        this.tracker = {
          ...parsed,
          queryCount: new Map(Object.entries(parsed.queryCount || {})),
          lastReset: {
            daily: new Date(parsed.lastReset.daily),
            monthly: new Date(parsed.lastReset.monthly)
          }
        };
      }
      
      // Check if we need to reset
      await this.checkAndResetPeriods();
    } catch (error) {
      this.logger.error('Failed to initialize cost tracker:', error);
    }
  }

  /**
   * Check if we need to reset daily or monthly counters
   */
  private async checkAndResetPeriods(): Promise<void> {
    const now = new Date();
    
    // Reset daily counter if needed
    if (!this.isSameDay(now, this.tracker.lastReset.daily)) {
      this.logger.info('Resetting daily cost counter');
      this.tracker.currentDailySpend = 0;
      this.tracker.lastReset.daily = now;
      
      // Clear daily query counts
      const dailyKey = this.getDailyKey(now);
      await this.redis.del(`${this.namespace}:daily:${dailyKey}`);
    }
    
    // Reset monthly counter if needed
    if (!this.isSameMonth(now, this.tracker.lastReset.monthly)) {
      this.logger.info('Resetting monthly cost counter');
      this.tracker.currentMonthlySpend = 0;
      this.tracker.lastReset.monthly = now;
      this.tracker.queryCount.clear();
      
      // Clear monthly data
      const monthlyKey = this.getMonthlyKey(now);
      await this.redis.del(`${this.namespace}:monthly:${monthlyKey}`);
    }
    
    await this.saveTracker();
  }

  /**
   * Check if budget allows for a query
   */
  async canMakeQuery(
    cost: number,
    provider: SerpApiProvider
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (!this.config.trackingEnabled) {
      return { allowed: true };
    }

    await this.checkAndResetPeriods();

    // Check daily budget
    if (this.tracker.currentDailySpend + cost > this.config.dailyBudget) {
      return {
        allowed: false,
        reason: `Daily budget exceeded. Current: $${this.tracker.currentDailySpend.toFixed(3)}, Budget: $${this.config.dailyBudget}`
      };
    }

    // Check monthly budget
    if (this.tracker.currentMonthlySpend + cost > this.config.monthlyBudget) {
      return {
        allowed: false,
        reason: `Monthly budget exceeded. Current: $${this.tracker.currentMonthlySpend.toFixed(3)}, Budget: $${this.config.monthlyBudget}`
      };
    }

    // Check for budget alerts
    await this.checkBudgetAlerts(cost);

    return { allowed: true };
  }

  /**
   * Track a query cost
   */
  async trackQuery(
    cost: number,
    provider: SerpApiProvider,
    query: string
  ): Promise<void> {
    if (!this.config.trackingEnabled) return;

    this.tracker.currentDailySpend += cost;
    this.tracker.currentMonthlySpend += cost;
    
    // Track per provider
    const currentCount = this.tracker.queryCount.get(provider) || 0;
    this.tracker.queryCount.set(provider, currentCount + 1);

    // Save to Redis
    await this.saveTracker();
    
    // Store detailed query info
    const now = new Date();
    const dailyKey = this.getDailyKey(now);
    const queryData = {
      query,
      provider,
      cost,
      timestamp: now.toISOString()
    };
    
    await this.redis.lpush(
      `${this.namespace}:queries:${dailyKey}`,
      JSON.stringify(queryData)
    );
    
    // Expire after 7 days
    await this.redis.expire(`${this.namespace}:queries:${dailyKey}`, 7 * 24 * 60 * 60);
  }

  /**
   * Check and trigger budget alerts
   */
  private async checkBudgetAlerts(additionalCost: number): Promise<void> {
    const dailyPercentage = (this.tracker.currentDailySpend + additionalCost) / this.config.dailyBudget;
    const monthlyPercentage = (this.tracker.currentMonthlySpend + additionalCost) / this.config.monthlyBudget;

    // Check daily budget alerts
    if (dailyPercentage >= this.config.budgetAlerts.criticalThreshold) {
      await this.triggerAlert({
        type: 'critical',
        currentSpend: this.tracker.currentDailySpend,
        budget: this.config.dailyBudget,
        percentage: dailyPercentage * 100,
        period: 'daily',
        timestamp: new Date()
      });
    } else if (dailyPercentage >= this.config.budgetAlerts.warningThreshold) {
      await this.triggerAlert({
        type: 'warning',
        currentSpend: this.tracker.currentDailySpend,
        budget: this.config.dailyBudget,
        percentage: dailyPercentage * 100,
        period: 'daily',
        timestamp: new Date()
      });
    }

    // Check monthly budget alerts
    if (monthlyPercentage >= this.config.budgetAlerts.criticalThreshold) {
      await this.triggerAlert({
        type: 'critical',
        currentSpend: this.tracker.currentMonthlySpend,
        budget: this.config.monthlyBudget,
        percentage: monthlyPercentage * 100,
        period: 'monthly',
        timestamp: new Date()
      });
    } else if (monthlyPercentage >= this.config.budgetAlerts.warningThreshold) {
      await this.triggerAlert({
        type: 'warning',
        currentSpend: this.tracker.currentMonthlySpend,
        budget: this.config.monthlyBudget,
        percentage: monthlyPercentage * 100,
        period: 'monthly',
        timestamp: new Date()
      });
    }
  }

  /**
   * Trigger a budget alert
   */
  private async triggerAlert(alert: BudgetAlert): Promise<void> {
    this.logger.warn(`Budget alert: ${alert.type} - ${alert.period} spend at ${alert.percentage.toFixed(1)}%`);
    
    // Store alert in Redis
    const alertKey = `${this.namespace}:alerts:${this.getDailyKey(new Date())}`;
    await this.redis.lpush(alertKey, JSON.stringify(alert));
    await this.redis.expire(alertKey, 7 * 24 * 60 * 60);
    
    // Call custom alert callback if provided
    if (this.config.budgetAlerts.alertCallback) {
      try {
        this.config.budgetAlerts.alertCallback(alert);
      } catch (error) {
        this.logger.error('Alert callback failed:', error);
      }
    }
  }

  /**
   * Get usage statistics
   */
  async getStats(): Promise<CostStats> {
    await this.checkAndResetPeriods();
    
    const now = new Date();
    const dailyQueries = await this.getDailyQueryCount();
    const monthlyQueries = await this.getMonthlyQueryCount();
    
    // Calculate projected monthly spend based on current rate
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysElapsed = now.getDate();
    const projectedMonthlySpend = (this.tracker.currentMonthlySpend / daysElapsed) * daysInMonth;
    
    return {
      daily: {
        spent: this.tracker.currentDailySpend,
        budget: this.config.dailyBudget,
        remaining: Math.max(0, this.config.dailyBudget - this.tracker.currentDailySpend),
        percentage: (this.tracker.currentDailySpend / this.config.dailyBudget) * 100,
        queriesCount: dailyQueries
      },
      monthly: {
        spent: this.tracker.currentMonthlySpend,
        budget: this.config.monthlyBudget,
        remaining: Math.max(0, this.config.monthlyBudget - this.tracker.currentMonthlySpend),
        percentage: (this.tracker.currentMonthlySpend / this.config.monthlyBudget) * 100,
        queriesCount: monthlyQueries
      },
      averageCostPerQuery: monthlyQueries > 0 ? this.tracker.currentMonthlySpend / monthlyQueries : 0,
      projectedMonthlySpend
    };
  }

  /**
   * Get cost breakdown by provider
   */
  async getCostBreakdown(): Promise<Map<string, { count: number; totalCost: number }>> {
    const breakdown = new Map<string, { count: number; totalCost: number }>();
    
    for (const [provider, count] of this.tracker.queryCount.entries()) {
      // Get provider-specific cost (this would need provider config)
      const avgCost = this.config.defaultCostPerQuery;
      breakdown.set(provider, {
        count,
        totalCost: count * avgCost
      });
    }
    
    return breakdown;
  }

  /**
   * Get historical data for a specific date
   */
  async getHistoricalData(date: Date): Promise<any> {
    const dailyKey = this.getDailyKey(date);
    const queries = await this.redis.lrange(`${this.namespace}:queries:${dailyKey}`, 0, -1);
    
    return queries.map(q => JSON.parse(q));
  }

  /**
   * Save tracker to Redis
   */
  private async saveTracker(): Promise<void> {
    const data = {
      ...this.tracker,
      queryCount: Object.fromEntries(this.tracker.queryCount),
      lastReset: {
        daily: this.tracker.lastReset.daily.toISOString(),
        monthly: this.tracker.lastReset.monthly.toISOString()
      }
    };
    
    await this.redis.set(
      `${this.namespace}:tracker`,
      JSON.stringify(data),
      'EX',
      30 * 24 * 60 * 60 // 30 days
    );
  }

  /**
   * Get daily query count
   */
  private async getDailyQueryCount(): Promise<number> {
    const dailyKey = this.getDailyKey(new Date());
    return await this.redis.llen(`${this.namespace}:queries:${dailyKey}`);
  }

  /**
   * Get monthly query count
   */
  private async getMonthlyQueryCount(): Promise<number> {
    let total = 0;
    for (const count of this.tracker.queryCount.values()) {
      total += count;
    }
    return total;
  }

  /**
   * Helper functions
   */
  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.toDateString() === date2.toDateString();
  }

  private isSameMonth(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth();
  }

  private getDailyKey(date: Date): string {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  private getMonthlyKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
  }

  /**
   * Reset all cost data (for testing)
   */
  async reset(): Promise<void> {
    this.tracker = {
      currentDailySpend: 0,
      currentMonthlySpend: 0,
      queryCount: new Map(),
      lastReset: {
        daily: new Date(),
        monthly: new Date()
      }
    };
    
    // Clear all Redis keys
    const keys = await this.redis.keys(`${this.namespace}:*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
    
    await this.saveTracker();
    this.logger.info('Cost manager reset');
  }
}