/**
 * Budget Manager
 * Manages API credits and budget limits for search intelligence
 */

import { Logger } from '../../utils/logger.js';
import { SerpApiProvider, ApiQuota } from '../types/search-intelligence.types.js';
import { CacheManager } from './cache-manager.js';

interface ProviderLimits {
  dailyLimit: number;
  monthlyLimit: number;
  costPerQuery: number; // in cents
}

export class BudgetManager {
  private logger: Logger;
  private cache: CacheManager;
  private providerLimits: Map<SerpApiProvider, ProviderLimits>;

  constructor() {
    this.logger = new Logger('BudgetManager');
    this.cache = new CacheManager();
    this.initializeProviderLimits();
  }

  /**
   * Initialize provider limits and costs
   */
  private initializeProviderLimits(): void {
    this.providerLimits = new Map([
      [SerpApiProvider.SERPAPI, {
        dailyLimit: parseInt(process.env.SERPAPI_DAILY_LIMIT || '1000'),
        monthlyLimit: parseInt(process.env.SERPAPI_MONTHLY_LIMIT || '30000'),
        costPerQuery: 0.5 // $0.005 per query
      }],
      [SerpApiProvider.VALUESERP, {
        dailyLimit: parseInt(process.env.VALUESERP_DAILY_LIMIT || '500'),
        monthlyLimit: parseInt(process.env.VALUESERP_MONTHLY_LIMIT || '15000'),
        costPerQuery: 0.3
      }],
      [SerpApiProvider.SCALESERP, {
        dailyLimit: parseInt(process.env.SCALESERP_DAILY_LIMIT || '1000'),
        monthlyLimit: parseInt(process.env.SCALESERP_MONTHLY_LIMIT || '25000'),
        costPerQuery: 0.4
      }],
      [SerpApiProvider.MOCK, {
        dailyLimit: Infinity,
        monthlyLimit: Infinity,
        costPerQuery: 0
      }]
    ]);
  }

  /**
   * Check if credits are available and deduct if possible
   */
  async checkAndDeductCredits(
    provider: SerpApiProvider | string,
    credits: number
  ): Promise<boolean> {
    const providerEnum = provider as SerpApiProvider;
    const limits = this.providerLimits.get(providerEnum);
    
    if (!limits) {
      this.logger.warn(`Unknown provider: ${provider}`);
      return false;
    }

    // Check daily and monthly usage
    const [dailyUsed, monthlyUsed] = await Promise.all([
      this.getDailyUsage(providerEnum),
      this.getMonthlyUsage(providerEnum)
    ]);

    // Check limits
    if (dailyUsed + credits > limits.dailyLimit) {
      this.logger.warn(`Daily limit reached for ${provider}: ${dailyUsed}/${limits.dailyLimit}`);
      return false;
    }

    if (monthlyUsed + credits > limits.monthlyLimit) {
      this.logger.warn(`Monthly limit reached for ${provider}: ${monthlyUsed}/${limits.monthlyLimit}`);
      return false;
    }

    // Deduct credits
    await this.incrementUsage(providerEnum, credits);
    
    // Log usage
    this.logger.info(`Deducted ${credits} credits from ${provider}. Daily: ${dailyUsed + credits}/${limits.dailyLimit}`);
    
    return true;
  }

  /**
   * Get current quota for a provider
   */
  async getQuota(provider: SerpApiProvider): Promise<ApiQuota> {
    const limits = this.providerLimits.get(provider);
    if (!limits) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    const [dailyUsed, monthlyUsed] = await Promise.all([
      this.getDailyUsage(provider),
      this.getMonthlyUsage(provider)
    ]);

    // Calculate reset dates
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    nextMonth.setHours(0, 0, 0, 0);

    // Use the more restrictive limit
    const dailyRemaining = limits.dailyLimit - dailyUsed;
    const monthlyRemaining = limits.monthlyLimit - monthlyUsed;
    const effectiveRemaining = Math.min(dailyRemaining, monthlyRemaining);

    return {
      provider,
      totalCredits: limits.monthlyLimit,
      usedCredits: monthlyUsed,
      remainingCredits: effectiveRemaining,
      resetDate: dailyRemaining < monthlyRemaining ? tomorrow : nextMonth
    };
  }

  /**
   * Get all provider quotas
   */
  async getAllQuotas(): Promise<ApiQuota[]> {
    const quotas: ApiQuota[] = [];
    
    for (const provider of this.providerLimits.keys()) {
      if (provider !== SerpApiProvider.MOCK) {
        try {
          const quota = await this.getQuota(provider);
          quotas.push(quota);
        } catch (error) {
          this.logger.error(`Failed to get quota for ${provider}:`, error);
        }
      }
    }

    return quotas;
  }

  /**
   * Get daily usage for a provider
   */
  private async getDailyUsage(provider: SerpApiProvider): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const key = `usage:daily:${provider}:${today}`;
    
    const usage = await this.cache.get<number>(key);
    return usage || 0;
  }

  /**
   * Get monthly usage for a provider
   */
  private async getMonthlyUsage(provider: SerpApiProvider): Promise<number> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const key = `usage:monthly:${provider}:${yearMonth}`;
    
    const usage = await this.cache.get<number>(key);
    return usage || 0;
  }

  /**
   * Increment usage counters
   */
  private async incrementUsage(provider: SerpApiProvider, credits: number): Promise<void> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const dailyKey = `usage:daily:${provider}:${today}`;
    const monthlyKey = `usage:monthly:${provider}:${yearMonth}`;

    // Increment counters
    await Promise.all([
      this.cache.increment(dailyKey, credits),
      this.cache.increment(monthlyKey, credits)
    ]);

    // Set expiration on daily counter (expires after 2 days)
    await this.cache.expire(dailyKey, 172800);
    
    // Set expiration on monthly counter (expires after 35 days)
    await this.cache.expire(monthlyKey, 3024000);
  }

  /**
   * Get estimated cost for queries
   */
  getEstimatedCost(provider: SerpApiProvider, queries: number): number {
    const limits = this.providerLimits.get(provider);
    if (!limits) return 0;
    
    return (limits.costPerQuery * queries) / 100; // Convert cents to dollars
  }

  /**
   * Get best available provider based on remaining credits
   */
  async getBestProvider(queriesNeeded: number): Promise<SerpApiProvider | null> {
    const providers = [
      SerpApiProvider.SERPAPI,
      SerpApiProvider.VALUESERP,
      SerpApiProvider.SCALESERP
    ];

    let bestProvider: SerpApiProvider | null = null;
    let lowestCost = Infinity;

    for (const provider of providers) {
      const quota = await this.getQuota(provider);
      
      if (quota.remainingCredits >= queriesNeeded) {
        const cost = this.getEstimatedCost(provider, queriesNeeded);
        
        if (cost < lowestCost) {
          lowestCost = cost;
          bestProvider = provider;
        }
      }
    }

    // Fallback to mock if no provider available
    if (!bestProvider && process.env.NODE_ENV === 'development') {
      return SerpApiProvider.MOCK;
    }

    return bestProvider;
  }

  /**
   * Reset usage counters (for testing)
   */
  async resetUsage(provider: SerpApiProvider): Promise<void> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const dailyKey = `usage:daily:${provider}:${today}`;
    const monthlyKey = `usage:monthly:${provider}:${yearMonth}`;

    await Promise.all([
      this.cache.delete(dailyKey),
      this.cache.delete(monthlyKey)
    ]);

    this.logger.info(`Reset usage counters for ${provider}`);
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(): Promise<{
    daily: Record<string, number>;
    monthly: Record<string, number>;
    costs: Record<string, number>;
  }> {
    const daily: Record<string, number> = {};
    const monthly: Record<string, number> = {};
    const costs: Record<string, number> = {};

    for (const [provider, limits] of this.providerLimits) {
      if (provider === SerpApiProvider.MOCK) continue;

      const [dailyUsage, monthlyUsage] = await Promise.all([
        this.getDailyUsage(provider),
        this.getMonthlyUsage(provider)
      ]);

      daily[provider] = dailyUsage;
      monthly[provider] = monthlyUsage;
      costs[provider] = (monthlyUsage * limits.costPerQuery) / 100;
    }

    return { daily, monthly, costs };
  }

  /**
   * Set custom limit for a provider (runtime override)
   */
  setProviderLimit(
    provider: SerpApiProvider,
    dailyLimit?: number,
    monthlyLimit?: number
  ): void {
    const limits = this.providerLimits.get(provider);
    if (!limits) {
      this.logger.warn(`Cannot set limits for unknown provider: ${provider}`);
      return;
    }

    if (dailyLimit !== undefined) {
      limits.dailyLimit = dailyLimit;
    }
    if (monthlyLimit !== undefined) {
      limits.monthlyLimit = monthlyLimit;
    }

    this.logger.info(`Updated limits for ${provider}: daily=${limits.dailyLimit}, monthly=${limits.monthlyLimit}`);
  }
}