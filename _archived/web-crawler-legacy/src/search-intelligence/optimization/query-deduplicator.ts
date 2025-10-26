/**
 * Query Deduplicator
 * Optimizes queries by removing duplicates and near-duplicates
 */

import { GeneratedQuery } from '../types/search-intelligence.types.js';
import { logger } from '../../utils/logger.js';

export class QueryDeduplicator {
  private readonly similarityThreshold = 0.85;
  
  /**
   * Deduplicate queries while maintaining diversity
   */
  deduplicateQueries(queries: GeneratedQuery[]): GeneratedQuery[] {
    const startCount = queries.length;
    const deduped = this.removeDuplicates(queries);
    const optimized = this.mergeNearDuplicates(deduped);
    
    const endCount = optimized.length;
    if (startCount > endCount) {
      logger.info(`Query deduplication reduced ${startCount} queries to ${endCount}`);
    }
    
    return optimized;
  }

  /**
   * Remove exact duplicates
   */
  private removeDuplicates(queries: GeneratedQuery[]): GeneratedQuery[] {
    const seen = new Map<string, GeneratedQuery>();
    
    for (const query of queries) {
      const normalized = this.normalizeQuery(query.query);
      
      if (!seen.has(normalized)) {
        seen.set(normalized, query);
      } else {
        // Keep the one with higher AI relevance
        const existing = seen.get(normalized)!;
        if (query.aiRelevance > existing.aiRelevance) {
          seen.set(normalized, query);
        }
      }
    }
    
    return Array.from(seen.values());
  }

  /**
   * Merge near-duplicate queries
   */
  private mergeNearDuplicates(queries: GeneratedQuery[]): GeneratedQuery[] {
    const merged: GeneratedQuery[] = [];
    const used = new Set<number>();
    
    for (let i = 0; i < queries.length; i++) {
      if (used.has(i)) continue;
      
      const baseQuery = queries[i];
      const similar: GeneratedQuery[] = [baseQuery];
      
      for (let j = i + 1; j < queries.length; j++) {
        if (used.has(j)) continue;
        
        const similarity = this.calculateSimilarity(
          baseQuery.query,
          queries[j].query
        );
        
        if (similarity >= this.similarityThreshold) {
          similar.push(queries[j]);
          used.add(j);
        }
      }
      
      // Merge similar queries
      if (similar.length > 1) {
        merged.push(this.mergeSimilarQueries(similar));
      } else {
        merged.push(baseQuery);
      }
    }
    
    return merged;
  }

  /**
   * Calculate similarity between two queries
   */
  private calculateSimilarity(query1: string, query2: string): number {
    const tokens1 = this.tokenize(query1);
    const tokens2 = this.tokenize(query2);
    
    const intersection = tokens1.filter(t => tokens2.includes(t));
    const union = [...new Set([...tokens1, ...tokens2])];
    
    return intersection.length / union.length;
  }

  /**
   * Merge similar queries into one optimized query
   */
  private mergeSimilarQueries(queries: GeneratedQuery[]): GeneratedQuery {
    // Sort by AI relevance
    queries.sort((a, b) => b.aiRelevance - a.aiRelevance);
    
    // Use the most relevant as base
    const merged = { ...queries[0] };
    
    // Average the scores
    merged.aiRelevance = queries.reduce((sum, q) => sum + q.aiRelevance, 0) / queries.length;
    merged.difficulty = queries.reduce((sum, q) => sum + q.difficulty, 0) / queries.length;
    
    // Combine intents
    const intents = [...new Set(queries.map(q => q.intent))];
    merged.intent = intents[0]; // Primary intent
    
    return merged;
  }

  /**
   * Normalize query for comparison
   */
  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Tokenize query for similarity calculation
   */
  private tokenize(query: string): string[] {
    return this.normalizeQuery(query)
      .split(' ')
      .filter(token => token.length > 2); // Ignore short words
  }

  /**
   * Prioritize queries by value
   */
  prioritizeQueries(queries: GeneratedQuery[], maxQueries: number): GeneratedQuery[] {
    if (queries.length <= maxQueries) {
      return queries;
    }

    // Calculate value score for each query
    const scored = queries.map(query => ({
      query,
      score: this.calculateQueryValue(query)
    }));

    // Sort by value score
    scored.sort((a, b) => b.score - a.score);

    // Return top queries with type diversity
    return this.ensureTypeDiversity(
      scored.slice(0, maxQueries).map(s => s.query),
      queries
    );
  }

  /**
   * Calculate query value based on multiple factors
   */
  private calculateQueryValue(query: GeneratedQuery): number {
    // Higher AI relevance = higher value
    const relevanceScore = query.aiRelevance / 10;
    
    // Lower difficulty = higher value
    const difficultyScore = (10 - query.difficulty) / 10;
    
    // Certain types are more valuable
    const typeMultiplier = this.getTypeMultiplier(query.type);
    
    // Certain intents are more valuable
    const intentMultiplier = this.getIntentMultiplier(query.intent);
    
    return (relevanceScore * 0.4 + difficultyScore * 0.3) * typeMultiplier * intentMultiplier;
  }

  /**
   * Get multiplier for query type
   */
  private getTypeMultiplier(type: string): number {
    const multipliers: Record<string, number> = {
      'informational': 1.2,
      'long-tail': 1.1,
      'comparison': 1.0,
      'brand': 0.9,
      'product': 0.9,
      'service': 0.8,
      'transactional': 0.7
    };
    
    return multipliers[type] || 1.0;
  }

  /**
   * Get multiplier for query intent
   */
  private getIntentMultiplier(intent: string): number {
    const multipliers: Record<string, number> = {
      'research': 1.2,
      'learn': 1.1,
      'compare': 1.0,
      'buy': 0.8
    };
    
    return multipliers[intent] || 1.0;
  }

  /**
   * Ensure type diversity in final query set
   */
  private ensureTypeDiversity(
    prioritized: GeneratedQuery[],
    allQueries: GeneratedQuery[]
  ): GeneratedQuery[] {
    const types = new Set(prioritized.map(q => q.type));
    const missingTypes = ['informational', 'brand', 'comparison', 'long-tail']
      .filter(type => !types.has(type));
    
    if (missingTypes.length === 0) {
      return prioritized;
    }
    
    // Replace lowest value queries with missing types
    const result = [...prioritized];
    let replaceIndex = prioritized.length - 1;
    
    for (const missingType of missingTypes) {
      const candidate = allQueries.find(q => 
        q.type === missingType && 
        !result.includes(q)
      );
      
      if (candidate && replaceIndex >= 0) {
        result[replaceIndex] = candidate;
        replaceIndex--;
      }
    }
    
    return result;
  }

  /**
   * Skip low-impact queries when budget is limited
   */
  skipLowImpactQueries(
    queries: GeneratedQuery[],
    remainingBudget: number,
    costPerQuery: number
  ): GeneratedQuery[] {
    const maxQueries = Math.floor(remainingBudget / costPerQuery);
    
    if (maxQueries >= queries.length) {
      return queries;
    }
    
    logger.warn(`Budget allows only ${maxQueries} queries, skipping low-impact ones`);
    
    // Filter out low-value queries first
    const highValue = queries.filter(q => 
      q.aiRelevance >= 6 && q.difficulty <= 7
    );
    
    if (highValue.length <= maxQueries) {
      return this.prioritizeQueries(queries, maxQueries);
    }
    
    return this.prioritizeQueries(highValue, maxQueries);
  }
}