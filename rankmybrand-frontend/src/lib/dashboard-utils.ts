/**
 * Dashboard Utilities - Safe data handling helpers
 *
 * These utilities provide type-safe operations for dashboard data to prevent:
 * - NaN in calculations
 * - Array operation crashes
 * - Type coercion errors
 * - Division by zero
 * - Invalid data rendering
 */

/**
 * Safely converts a value to a number, returning a default if invalid
 */
export function safeNumber(value: any, defaultValue: number = 0): number {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return defaultValue;
  }

  // If already a number, check if valid
  if (typeof value === 'number') {
    return isNaN(value) || !isFinite(value) ? defaultValue : value;
  }

  // Try to convert string to number
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) || !isFinite(parsed) ? defaultValue : parsed;
  }

  // For any other type, return default
  return defaultValue;
}

/**
 * Safely converts a value to a score (0-100 range)
 */
export function safeScore(value: any, defaultValue: number = 0): number {
  const num = safeNumber(value, defaultValue);
  // Clamp between 0 and 100
  return Math.max(0, Math.min(100, num));
}

/**
 * Calculates a weighted average with safe number handling
 */
export function weightedAverage(
  values: Array<{ value: any; weight: number }>,
  defaultValue: number = 0
): number {
  // Validate inputs
  if (!Array.isArray(values) || values.length === 0) {
    return defaultValue;
  }

  let totalWeight = 0;
  let weightedSum = 0;

  for (const item of values) {
    const value = safeNumber(item.value, 0);
    const weight = safeNumber(item.weight, 0);

    if (weight > 0) {
      weightedSum += value * weight;
      totalWeight += weight;
    }
  }

  // Prevent division by zero
  if (totalWeight === 0) {
    return defaultValue;
  }

  const result = weightedSum / totalWeight;
  return isNaN(result) || !isFinite(result) ? defaultValue : Math.round(result);
}

/**
 * Safely validates an array and returns empty array if invalid
 */
export function safeArray<T>(value: any): T[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Safely filters and validates array elements
 */
export function safeFilterArray<T>(
  value: any,
  predicate: (item: T) => boolean
): T[] {
  const arr = safeArray<T>(value);
  try {
    return arr.filter(item => {
      // Filter out null/undefined items
      if (item === null || item === undefined) {
        return false;
      }
      return predicate(item);
    });
  } catch (error) {
    console.warn('Error filtering array:', error);
    return [];
  }
}

/**
 * Safely sorts an array by numeric value
 */
export function safeSortByNumber<T>(
  array: T[],
  getValue: (item: T) => any,
  ascending: boolean = true
): T[] {
  if (!Array.isArray(array)) {
    return [];
  }

  try {
    return [...array].sort((a, b) => {
      const aVal = safeNumber(getValue(a), 0);
      const bVal = safeNumber(getValue(b), 0);
      return ascending ? aVal - bVal : bVal - aVal;
    });
  } catch (error) {
    console.warn('Error sorting array:', error);
    return array;
  }
}

/**
 * Safely gets a nested property from an object
 */
export function safeGet(obj: any, path: string, defaultValue: any = undefined): any {
  if (!obj || typeof obj !== 'object') {
    return defaultValue;
  }

  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return defaultValue;
    }
    current = current[key];
  }

  return current !== undefined ? current : defaultValue;
}

/**
 * Safely formats a date string
 */
export function safeFormatDate(date: any, defaultValue: string = 'Unknown'): string {
  try {
    if (!date) return defaultValue;

    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return defaultValue;
    }

    return d.toLocaleString();
  } catch (error) {
    return defaultValue;
  }
}

/**
 * Validates competitor data for D3 visualization
 */
export interface ValidatedCompetitor {
  name: string;
  mentionCount: number;
  sentiment: number;
  dominance: number;
}

export function validateCompetitorData(competitors: any[]): ValidatedCompetitor[] {
  if (!Array.isArray(competitors)) {
    return [];
  }

  return competitors
    .filter(c => {
      // Must be an object with required fields
      return (
        c &&
        typeof c === 'object' &&
        (typeof c.name === 'string' || typeof c.competitor_name === 'string') &&
        c.name !== null &&
        c.name !== undefined
      );
    })
    .map(c => ({
      name: String(c.name || c.competitor_name || 'Unknown'),
      mentionCount: safeNumber(c.mentionCount || c.mention_count, 1), // Default to 1 to avoid zero-size bubbles
      sentiment: safeScore(c.sentiment, 50), // Default to neutral
      dominance: safeScore(c.dominance, 50), // Default to middle
    }));
}

/**
 * Validates query data
 */
export interface ValidatedQuery {
  text: string;
  responseCount: number;
  avgScore: number;
  category: string;
}

export function validateQueryData(queries: any[]): ValidatedQuery[] {
  if (!Array.isArray(queries)) {
    return [];
  }

  return queries
    .filter(q => {
      return (
        q &&
        typeof q === 'object' &&
        (q.text || q.query_text)
      );
    })
    .map(q => ({
      text: String(q.text || q.query_text || 'Unknown Query'),
      responseCount: safeNumber(q.responseCount || q.response_count, 0),
      avgScore: safeScore(q.avgScore || q.avg_score, 0),
      category: String(q.category || 'uncategorized'),
    }));
}

/**
 * Calculates priority indicator based on response count
 */
export function getPriorityIndicator(responseCount: any) {
  const count = safeNumber(responseCount, 0);

  if (count === 0) {
    return { emoji: '🔥', label: 'Critical - No responses', color: 'text-red-600' };
  } else if (count < 3) {
    return { emoji: '⚠️', label: 'Warning - Low responses', color: 'text-yellow-600' };
  } else {
    return { emoji: '⭐', label: 'Good performance', color: 'text-green-600' };
  }
}

/**
 * Validates and calculates health status from scores
 */
export interface HealthStatus {
  label: string;
  color: string;
  icon: string;
  bg: string;
  border: string;
}

export function calculateHealthStatus(scores: {
  overall?: any;
  sentiment?: any;
  recommendation?: any;
}): { avgScore: number; status: HealthStatus } {
  // Calculate weighted average with safe number handling
  const avgScore = weightedAverage([
    { value: scores.overall, weight: 0.4 },
    { value: scores.sentiment, weight: 0.3 },
    { value: scores.recommendation, weight: 0.3 },
  ]);

  let status: HealthStatus;

  if (avgScore >= 70) {
    status = {
      label: 'Excellent',
      color: 'from-green-500 to-emerald-500',
      icon: '✨',
      bg: 'bg-green-50',
      border: 'border-green-300'
    };
  } else if (avgScore >= 50) {
    status = {
      label: 'Good',
      color: 'from-blue-500 to-cyan-500',
      icon: '👍',
      bg: 'bg-blue-50',
      border: 'border-blue-300'
    };
  } else if (avgScore >= 30) {
    status = {
      label: 'Needs Attention',
      color: 'from-yellow-500 to-orange-500',
      icon: '⚠️',
      bg: 'bg-yellow-50',
      border: 'border-yellow-300'
    };
  } else {
    status = {
      label: 'Critical',
      color: 'from-red-500 to-pink-500',
      icon: '🚨',
      bg: 'bg-red-50',
      border: 'border-red-300'
    };
  }

  return { avgScore, status };
}

/**
 * Gets border color class based on score
 */
export function getScoreBorderColor(score: any): string {
  const safeScoreValue = safeScore(score, 0);

  if (safeScoreValue < 40) return 'border-red-300';
  if (safeScoreValue < 60) return 'border-yellow-300';
  return 'border-green-300';
}

/**
 * Identifies critical issues from scores
 */
export function identifyCriticalIssues(
  scores: {
    overall?: any;
    sentiment?: any;
    recommendation?: any;
  },
  insights?: any[]
): string[] {
  const issues: string[] = [];

  const overallScore = safeScore(scores.overall, 0);
  const sentimentScore = safeScore(scores.sentiment, 0);
  const recommendationScore = safeScore(scores.recommendation, 0);

  if (overallScore < 40) {
    issues.push('Low visibility');
  }

  if (sentimentScore < 40) {
    issues.push('Poor sentiment');
  }

  if (recommendationScore < 40) {
    issues.push('Low recommendations');
  }

  const highPriorityCount = safeFilterArray(insights, (i: any) =>
    i.importance === 'high'
  ).length;

  if (highPriorityCount > 3) {
    issues.push(`${highPriorityCount} critical insights`);
  }

  return issues;
}
