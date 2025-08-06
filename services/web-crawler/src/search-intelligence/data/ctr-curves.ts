/**
 * CTR Curves and AI Visibility Data
 * Based on industry research and studies
 */

import { CTRCurve } from '../types/ranking-analyzer.types.js';

/**
 * Standard CTR curve based on Advanced Web Ranking data
 */
export const STANDARD_CTR_CURVE: CTRCurve[] = [
  { position: 1, ctr: 0.2823, withFeaturedSnippet: 0.08, withAds: 0.18 },
  { position: 2, ctr: 0.1506, withFeaturedSnippet: 0.12, withAds: 0.13 },
  { position: 3, ctr: 0.1011, withFeaturedSnippet: 0.09, withAds: 0.09 },
  { position: 4, ctr: 0.0651, withFeaturedSnippet: 0.06, withAds: 0.06 },
  { position: 5, ctr: 0.0494, withFeaturedSnippet: 0.05, withAds: 0.05 },
  { position: 6, ctr: 0.0384, withFeaturedSnippet: 0.04, withAds: 0.04 },
  { position: 7, ctr: 0.0308, withFeaturedSnippet: 0.03, withAds: 0.03 },
  { position: 8, ctr: 0.0251, withFeaturedSnippet: 0.025, withAds: 0.025 },
  { position: 9, ctr: 0.0209, withFeaturedSnippet: 0.02, withAds: 0.02 },
  { position: 10, ctr: 0.0176, withFeaturedSnippet: 0.017, withAds: 0.017 },
  { position: 11, ctr: 0.0135, withFeaturedSnippet: 0.013, withAds: 0.013 },
  { position: 12, ctr: 0.0118, withFeaturedSnippet: 0.011, withAds: 0.011 },
  { position: 13, ctr: 0.0105, withFeaturedSnippet: 0.010, withAds: 0.010 },
  { position: 14, ctr: 0.0094, withFeaturedSnippet: 0.009, withAds: 0.009 },
  { position: 15, ctr: 0.0085, withFeaturedSnippet: 0.008, withAds: 0.008 },
  { position: 16, ctr: 0.0077, withFeaturedSnippet: 0.007, withAds: 0.007 },
  { position: 17, ctr: 0.0070, withFeaturedSnippet: 0.007, withAds: 0.007 },
  { position: 18, ctr: 0.0064, withFeaturedSnippet: 0.006, withAds: 0.006 },
  { position: 19, ctr: 0.0058, withFeaturedSnippet: 0.006, withAds: 0.006 },
  { position: 20, ctr: 0.0053, withFeaturedSnippet: 0.005, withAds: 0.005 }
];

/**
 * Mobile CTR curve (generally higher for top positions)
 */
export const MOBILE_CTR_CURVE: CTRCurve[] = [
  { position: 1, ctr: 0.3245 },
  { position: 2, ctr: 0.1632 },
  { position: 3, ctr: 0.1089 },
  { position: 4, ctr: 0.0678 },
  { position: 5, ctr: 0.0489 },
  { position: 6, ctr: 0.0356 },
  { position: 7, ctr: 0.0267 },
  { position: 8, ctr: 0.0205 },
  { position: 9, ctr: 0.0160 },
  { position: 10, ctr: 0.0126 }
];

/**
 * AI Citation Likelihood based on position and factors
 */
export const AI_CITATION_LIKELIHOOD = {
  // Base likelihood by position
  positionBased: [
    { range: [1, 3], likelihood: 0.90 },   // 90% for top 3
    { range: [4, 6], likelihood: 0.70 },   // 70% for 4-6
    { range: [7, 10], likelihood: 0.50 },  // 50% for 7-10
    { range: [11, 15], likelihood: 0.30 }, // 30% for 11-15
    { range: [16, 20], likelihood: 0.20 }, // 20% for 16-20
    { range: [21, 100], likelihood: 0.10 } // 10% for beyond 20
  ],
  
  // Modifiers based on SERP features
  serpFeatureModifiers: {
    featuredSnippet: 0.95,      // If you have the featured snippet
    knowledgePanel: 0.85,       // If you're in knowledge panel
    peopleAlsoAsk: 0.15,        // Boost if appearing in PAA
    videoResults: 0.10,         // Video presence
    imageCarousel: 0.05,        // Image presence
    localPack: 0.20,           // Local pack presence
    newsResults: 0.15          // News results
  },
  
  // Query type modifiers
  queryTypeModifiers: {
    'informational': 0.10,     // AI prefers informational content
    'brand': 0.05,            // Brand queries get boost
    'comparison': 0.15,       // Comparisons heavily cited
    'long-tail': 0.20,        // Long-tail queries favor AI
    'transactional': -0.10,   // Less likely for transactional
    'product': 0.00,          // Neutral
    'service': 0.00,          // Neutral
    'local': -0.05           // Slightly less for local
  },
  
  // Competition modifiers
  competitionModifiers: [
    { competitorsAbove: 0, modifier: 0.10 },    // No competition above
    { competitorsAbove: 2, modifier: 0.00 },    // 1-2 competitors
    { competitorsAbove: 5, modifier: -0.10 },   // 3-5 competitors
    { competitorsAbove: 10, modifier: -0.20 }   // Many competitors
  ]
};

/**
 * Position value weights for visibility scoring
 */
export const POSITION_WEIGHTS = {
  1: 100,
  2: 70,
  3: 50,
  4: 35,
  5: 25,
  6: 20,
  7: 16,
  8: 13,
  9: 11,
  10: 9,
  11: 7,
  12: 6,
  13: 5,
  14: 4.5,
  15: 4,
  16: 3.5,
  17: 3,
  18: 2.5,
  19: 2,
  20: 1.5,
  default: 0.5
};

/**
 * SERP feature visibility impact
 */
export const SERP_FEATURE_IMPACT = {
  featuredSnippet: {
    ownFeature: 40,      // Huge boost if you own it
    otherHasFeature: -15  // Penalty if competitor has it
  },
  knowledgePanel: {
    ownFeature: 30,
    otherHasFeature: -10
  },
  peopleAlsoAsk: {
    ownFeature: 10,
    otherHasFeature: -5
  },
  localPack: {
    ownFeature: 25,
    otherHasFeature: -8
  },
  videoCarousel: {
    ownFeature: 15,
    otherHasFeature: -5
  },
  imageCarousel: {
    ownFeature: 10,
    otherHasFeature: -3
  },
  shoppingResults: {
    ownFeature: 20,
    otherHasFeature: -10
  },
  newsResults: {
    ownFeature: 15,
    otherHasFeature: -5
  },
  ads: {
    perAd: -3  // Each ad reduces organic visibility
  }
};

/**
 * Opportunity scoring factors
 */
export const OPPORTUNITY_SCORES = {
  // Position improvements
  positionGains: {
    toTop3: { from11_20: 90, from4_10: 70, from21_plus: 95 },
    toTop10: { from11_20: 60, from21_plus: 80 },
    toFirstPage: { from21_plus: 70 }
  },
  
  // Content gap priorities
  contentGapPriority: {
    highCompetitorCount: 0.8,   // Many competitors ranking
    brandQuery: 0.9,            // Our brand but not ranking
    highSearchVolume: 0.7,      // Popular queries
    lowCompetition: 0.6         // Easy wins
  },
  
  // Featured snippet opportunity
  snippetOpportunity: {
    currentlyRanking1_3: 0.9,   // Already close
    currentlyRanking4_10: 0.7,  // Good chance
    hasStructuredContent: 0.2,   // Boost for good content
    competitorHasSnippet: 0.3   // Can steal it
  }
};

/**
 * Difficulty estimation factors
 */
export const DIFFICULTY_FACTORS = {
  // Domain authority requirements by position
  authorityRequirements: [
    { position: [1, 3], minAuthority: 70 },
    { position: [4, 10], minAuthority: 50 },
    { position: [11, 20], minAuthority: 30 }
  ],
  
  // Competition density impact
  competitionDensity: {
    low: { threshold: 3, multiplier: 0.8 },      // <3 strong competitors
    medium: { threshold: 6, multiplier: 1.0 },   // 3-6 competitors
    high: { threshold: 10, multiplier: 1.3 },    // 7-10 competitors
    extreme: { threshold: 15, multiplier: 1.6 }  // >10 competitors
  },
  
  // SERP feature complexity
  serpComplexity: {
    clean: { features: 2, multiplier: 0.9 },     // Few SERP features
    moderate: { features: 4, multiplier: 1.0 },  // Some features
    complex: { features: 6, multiplier: 1.2 },   // Many features
    saturated: { features: 8, multiplier: 1.4 }  // Heavily featured
  }
};

/**
 * Get CTR for a specific position
 */
export function getCTR(
  position: number,
  hasFeaturedSnippet: boolean = false,
  hasAds: boolean = false,
  isMobile: boolean = false
): number {
  if (position < 1 || position > 20) return 0;
  
  const curve = isMobile ? MOBILE_CTR_CURVE : STANDARD_CTR_CURVE;
  const positionData = curve.find(c => c.position === position) || STANDARD_CTR_CURVE[19];
  
  if (hasFeaturedSnippet && positionData.withFeaturedSnippet) {
    return positionData.withFeaturedSnippet;
  }
  
  if (hasAds && positionData.withAds) {
    return positionData.withAds;
  }
  
  return positionData.ctr;
}

/**
 * Calculate position value
 */
export function getPositionValue(position: number): number {
  if (position < 1) return 0;
  if (position > 20) return POSITION_WEIGHTS.default;
  
  return POSITION_WEIGHTS[position as keyof typeof POSITION_WEIGHTS] || POSITION_WEIGHTS.default;
}

/**
 * Calculate AI citation likelihood
 */
export function getAICitationLikelihood(
  position: number,
  queryType: string,
  hasSerpFeatures: boolean,
  competitorsAbove: number
): number {
  // Base likelihood from position
  let likelihood = 0;
  for (const range of AI_CITATION_LIKELIHOOD.positionBased) {
    if (position >= range.range[0] && position <= range.range[1]) {
      likelihood = range.likelihood;
      break;
    }
  }
  
  // Apply query type modifier
  const queryModifier = AI_CITATION_LIKELIHOOD.queryTypeModifiers[queryType as keyof typeof AI_CITATION_LIKELIHOOD.queryTypeModifiers] || 0;
  likelihood += queryModifier;
  
  // Apply competition modifier
  let competitionModifier = 0;
  for (const comp of AI_CITATION_LIKELIHOOD.competitionModifiers) {
    if (competitorsAbove <= comp.competitorsAbove) {
      competitionModifier = comp.modifier;
      break;
    }
  }
  likelihood += competitionModifier;
  
  // Apply SERP feature boost
  if (hasSerpFeatures) {
    likelihood += 0.10;
  }
  
  // Ensure likelihood stays within 0-1 range
  return Math.max(0, Math.min(1, likelihood));
}