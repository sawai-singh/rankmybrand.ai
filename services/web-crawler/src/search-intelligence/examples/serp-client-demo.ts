/**
 * SERP Client Demo
 * Demonstrates the enhanced SERP client capabilities
 */

import { Redis } from 'ioredis';
import { EnhancedSerpClient } from '../core/serp-client-v2.js';
import {
  SerpClientConfig,
  SerpApiProvider,
  SearchOptions,
  BatchOptions
} from '../types/serp-client.types.js';

async function runDemo() {
  // Initialize Redis
  const redis = new Redis({
    host: 'localhost',
    port: 6379,
    keyPrefix: 'serp-demo:'
  });

  // Configure SERP client
  const config: SerpClientConfig = {
    providers: [
      {
        name: SerpApiProvider.SERPAPI,
        apiKey: process.env.SERPAPI_KEY || 'your-api-key',
        baseUrl: 'https://serpapi.com',
        priority: 1,
        enabled: true,
        costPerQuery: 0.01,
        rateLimit: 10
      },
      {
        name: SerpApiProvider.VALUESERP,
        apiKey: process.env.VALUESERP_KEY || 'your-api-key',
        baseUrl: 'https://api.valueserp.com',
        priority: 2,
        enabled: true,
        costPerQuery: 0.008
      },
      {
        name: SerpApiProvider.MOCK,
        apiKey: 'mock',
        baseUrl: 'https://mock.api',
        priority: 3,
        enabled: true,
        costPerQuery: 0
      }
    ],
    cache: {
      enabled: true,
      ttl: 24 * 60 * 60, // 24 hours
      namespace: 'serp:cache',
      compress: true,
      warmupQueries: [
        'best CRM software',
        'cloud storage providers',
        'project management tools'
      ]
    },
    rateLimiting: {
      requestsPerSecond: 5,
      burstLimit: 10,
      concurrentRequests: 3,
      backoffStrategy: 'exponential',
      maxRetries: 3
    },
    costManagement: {
      dailyBudget: 10, // $10/day
      monthlyBudget: 300, // $300/month
      defaultCostPerQuery: 0.01,
      budgetAlerts: {
        warningThreshold: 0.8,
        criticalThreshold: 0.95,
        alertCallback: (alert) => {
          console.warn(`BUDGET ALERT [${alert.type}]: ${alert.period} spend at ${alert.percentage.toFixed(1)}%`);
          console.warn(`Current: $${alert.currentSpend.toFixed(2)} / Budget: $${alert.budget}`);
        }
      },
      trackingEnabled: true
    },
    errorHandling: {
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 60000,
      fallbackToCacheOnError: true,
      detailedLogging: true
    }
  };

  // Create client
  const client = new EnhancedSerpClient(redis, config);

  console.log('=== Enhanced SERP Client Demo ===\n');

  // Example 1: Basic Search
  console.log('1. Basic Search Example:');
  console.log('------------------------');
  
  try {
    const result = await client.search('best project management software 2024');
    
    console.log(`Query: "${result.query}"`);
    console.log(`Provider: ${result.provider}`);
    console.log(`Cached: ${result.cached}`);
    console.log(`Cost: $${result.cost.toFixed(3)}`);
    console.log(`Results: ${result.results.length}`);
    console.log(`Total Results: ${result.totalResults.toLocaleString()}`);
    console.log(`Search Time: ${result.searchTime}ms`);
    
    console.log('\nTop 3 Results:');
    result.results.slice(0, 3).forEach(r => {
      console.log(`  ${r.position}. ${r.title}`);
      console.log(`     ${r.url}`);
      console.log(`     ${r.snippet.substring(0, 100)}...`);
    });
    
    console.log('\nSERP Features:');
    Object.entries(result.features).forEach(([feature, hasFeature]) => {
      if (hasFeature) console.log(`  ✓ ${feature}`);
    });
  } catch (error) {
    console.error('Search failed:', error);
  }

  console.log('\n');

  // Example 2: Search with Options
  console.log('2. Search with Options:');
  console.log('-----------------------');
  
  const searchOptions: SearchOptions = {
    location: 'United States',
    language: 'en',
    device: 'mobile',
    num: 10,
    provider: SerpApiProvider.MOCK // Use mock for demo
  };
  
  try {
    const result = await client.search('smartphone reviews', searchOptions);
    console.log(`Mobile results for "smartphone reviews": ${result.results.length}`);
    console.log(`Location: ${searchOptions.location}`);
    console.log(`Device: ${searchOptions.device}`);
  } catch (error) {
    console.error('Search failed:', error);
  }

  console.log('\n');

  // Example 3: Batch Search with Progress
  console.log('3. Batch Search Example:');
  console.log('------------------------');
  
  const queries = [
    'artificial intelligence trends',
    'machine learning frameworks',
    'deep learning applications',
    'neural network architectures',
    'AI ethics guidelines'
  ];
  
  const batchOptions: BatchOptions = {
    concurrency: 2,
    progressCallback: (progress) => {
      const percentage = (progress.completed / progress.total * 100).toFixed(0);
      console.log(`  Progress: ${progress.completed}/${progress.total} (${percentage}%) - Cost: $${progress.estimatedCost.toFixed(3)}`);
    },
    stopOnBudgetExceeded: true
  };
  
  try {
    const batchResult = await client.batchSearch(queries, batchOptions);
    
    console.log('\nBatch Summary:');
    console.log(`  Total Queries: ${batchResult.summary.totalQueries}`);
    console.log(`  Successful: ${batchResult.summary.successful}`);
    console.log(`  Failed: ${batchResult.summary.failed}`);
    console.log(`  Cached: ${batchResult.summary.cached}`);
    console.log(`  Total Cost: $${batchResult.summary.totalCost.toFixed(3)}`);
    console.log(`  Total Time: ${(batchResult.summary.totalTime / 1000).toFixed(2)}s`);
    
    if (batchResult.summary.errors.length > 0) {
      console.log('\n  Errors:');
      batchResult.summary.errors.forEach(e => {
        console.log(`    - ${e.query}: ${e.error}`);
      });
    }
  } catch (error) {
    console.error('Batch search failed:', error);
  }

  console.log('\n');

  // Example 4: Usage Statistics
  console.log('4. Usage Statistics:');
  console.log('--------------------');
  
  try {
    const stats = await client.getUsageStats();
    
    console.log('Cost Stats:');
    console.log(`  Daily: $${stats.cost.daily.spent.toFixed(2)} / $${stats.cost.daily.budget} (${stats.cost.daily.percentage.toFixed(1)}%)`);
    console.log(`  Monthly: $${stats.cost.monthly.spent.toFixed(2)} / $${stats.cost.monthly.budget} (${stats.cost.monthly.percentage.toFixed(1)}%)`);
    console.log(`  Avg Cost/Query: $${stats.cost.averageCostPerQuery.toFixed(3)}`);
    console.log(`  Projected Monthly: $${stats.cost.projectedMonthlySpend.toFixed(2)}`);
    
    console.log('\nCache Stats:');
    console.log(`  Hit Rate: ${stats.cache.hitRate.toFixed(1)}%`);
    console.log(`  Hits: ${stats.cache.hits} / Misses: ${stats.cache.misses}`);
    console.log(`  Cached Entries: ${stats.cache.size}`);
    if (stats.cache.compressionRatio !== undefined) {
      console.log(`  Compression Savings: ${(stats.cache.compressionRatio * 100).toFixed(1)}%`);
    }
    
    console.log('\nProvider Health:');
    stats.providers.forEach(p => {
      const status = p.availability === 1 ? '✓ Healthy' : '✗ Down';
      console.log(`  ${p.provider}: ${status} (${p.queriesCount} queries, ${(p.errorRate * 100).toFixed(1)}% errors)`);
    });
    
    console.log('\nRate Limiting:');
    console.log(`  Current Rate: ${stats.rateLimit.currentRate.toFixed(1)} req/s`);
    console.log(`  Peak Rate: ${stats.rateLimit.peakRate.toFixed(1)} req/s`);
    console.log(`  Queue Size: ${stats.rateLimit.queueSize}`);
    console.log(`  Throttled: ${stats.rateLimit.throttledRequests}`);
  } catch (error) {
    console.error('Failed to get stats:', error);
  }

  console.log('\n');

  // Example 5: Cache Management
  console.log('5. Cache Management:');
  console.log('--------------------');
  
  try {
    // Get cached queries
    const cacheManager = (client as any).cacheManager;
    const cachedQueries = await cacheManager.getCachedQueries();
    
    console.log(`Cached Queries (${cachedQueries.length}):`);
    cachedQueries.slice(0, 5).forEach(q => {
      const age = Date.now() - new Date(q.timestamp).getTime();
      const ageHours = (age / (1000 * 60 * 60)).toFixed(1);
      console.log(`  - "${q.query}" (${ageHours}h old)`);
    });
    
    // Prune old entries
    const pruned = await cacheManager.prune();
    console.log(`\nPruned ${pruned} orphaned cache entries`);
    
    // Warm up cache
    console.log('\nWarming up cache...');
    await client.warmupCache();
    console.log('Cache warmup completed');
  } catch (error) {
    console.error('Cache management failed:', error);
  }

  console.log('\n');

  // Example 6: Error Handling
  console.log('6. Error Handling Examples:');
  console.log('---------------------------');
  
  // Simulate budget exceeded
  try {
    const costManager = (client as any).costManager;
    // Artificially set high spend
    costManager.tracker.currentDailySpend = 9.8;
    
    await client.search('expensive query');
  } catch (error) {
    console.log(`Budget Error: ${error.message}`);
  }
  
  // Test circuit breaker
  console.log('\nCircuit Breaker Status:');
  const circuitBreakerFactory = (client as any).circuitBreakerFactory;
  const healthStatus = circuitBreakerFactory.getHealthStatus();
  Object.entries(healthStatus).forEach(([provider, healthy]) => {
    console.log(`  ${provider}: ${healthy ? 'Closed (Healthy)' : 'Open (Unhealthy)'}`);
  });

  console.log('\n');

  // Example 7: Advanced Features
  console.log('7. Advanced Features:');
  console.log('---------------------');
  
  // Rate limiter info
  const rateLimiter = (client as any).rateLimiter;
  const queueInfo = rateLimiter.getQueueInfo();
  console.log('Rate Limiter Queue:');
  console.log(`  Size: ${queueInfo.size}`);
  if (queueInfo.oldestItem) {
    console.log(`  Oldest: ${queueInfo.oldestItem.id} (${queueInfo.oldestItem.age}ms)`);
  }
  console.log(`  Priorities: ${JSON.stringify(queueInfo.priorities)}`);
  
  // Wait for all requests to complete
  console.log('\nWaiting for queue to empty...');
  await rateLimiter.waitForEmpty();
  console.log('All requests completed');

  // Cleanup
  await client.destroy();
  redis.disconnect();
  
  console.log('\n=== Demo Complete ===');
}

// Run demo
runDemo().catch(console.error);