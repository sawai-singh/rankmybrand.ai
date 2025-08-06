# Enhanced Ranking Analyzer v2

A comprehensive SERP ranking analysis engine with AI visibility prediction, pattern recognition, and competitive intelligence capabilities.

## Overview

The Enhanced Ranking Analyzer v2 processes search results to determine exact rankings, analyze competitor positions, identify SERP features, and predict AI visibility with advanced pattern recognition.

## Features

### 🎯 Position Detection
- **Multi-URL Support**: Tracks all URLs from your domain in SERPs
- **Subdomain Recognition**: Optional subdomain matching
- **Homepage Detection**: Identifies homepage vs. deep page rankings
- **Exact Position Tracking**: Precise position for all organic results

### 🔍 SERP Feature Recognition
- **Featured Snippet Detection**: Identifies ownership and opportunities
- **Knowledge Panel Analysis**: Tracks brand presence
- **Rich Results Tracking**: People Also Ask, Local Pack, Videos, etc.
- **Ad Impact Analysis**: Measures organic visibility reduction from ads

### 🏆 Competitor Tracking
- **Real-Time Position Monitoring**: Track competitor rankings
- **Head-to-Head Analysis**: Direct comparison metrics
- **Overlap Detection**: Queries where both you and competitors rank
- **Dominance Mapping**: Identifies competitor strengths/weaknesses

### 🤖 AI Visibility Prediction
- **Citation Likelihood Scoring**: 0-100% likelihood per query
- **Multi-Factor Analysis**: Position, SERP features, competition
- **Query Type Weighting**: Different weights for different intents
- **Improvement Recommendations**: Actionable steps to increase visibility

### 📊 Pattern Recognition
- **Content Gap Analysis**: Identifies missing content opportunities
- **Query Type Performance**: Analyzes performance by intent
- **SERP Feature Correlation**: Links features to ranking patterns
- **Temporal Trends**: Historical comparison capabilities

### 💡 Opportunity Identification
- **Low Hanging Fruit**: Easy wins in positions 11-20
- **Featured Snippet Targets**: Queries to optimize for snippets
- **Competitor Gaps**: Where competitors rank but you don't
- **Content Recommendations**: Prioritized improvement suggestions

## Installation

```bash
npm install
```

## Configuration

```typescript
const config: RankingAnalysisConfig = {
  targetDomain: 'yourdomain.com',
  competitors: ['competitor1.com', 'competitor2.com'],
  includeSubdomains: true,        // Include blog.yourdomain.com, etc.
  trackSerpFeatures: true,         // Track rich results
  calculateVisibility: true,       // Calculate visibility scores
  identifyPatterns: true          // Enable pattern recognition
};

const analyzer = new EnhancedRankingAnalyzer(config);
```

## Usage

### Basic Analysis

```typescript
import { EnhancedRankingAnalyzer } from './ranking-analyzer-v2';

// Analyze rankings for generated queries
const result = await analyzer.analyzeRankings(queries, searchResults);

console.log(`Average Position: ${result.summary.averagePosition}`);
console.log(`AI Visibility Score: ${result.aiVisibilityPrediction.overallScore}/100`);
```

### Detailed Position Analysis

```typescript
// Get detailed position results
result.rankings.forEach(ranking => {
  console.log(`Query: ${ranking.query}`);
  console.log(`Position: ${ranking.position || 'Not ranking'}`);
  console.log(`URL: ${ranking.url || 'N/A'}`);
  console.log(`AI Citation Likelihood: ${ranking.visibilityScore.aiCitationLikelihood}%`);
  
  // Multiple URLs for same domain
  if (ranking.multipleUrls.length > 1) {
    console.log('Multiple URLs ranking:');
    ranking.multipleUrls.forEach(url => {
      console.log(`  - Position ${url.position}: ${url.url}`);
    });
  }
});
```

### SERP Feature Analysis

```typescript
// Analyze SERP features
const features = result.patterns.serpFeatureCorrelation;

console.log('Featured Snippet Opportunities:');
features.featuredSnippetQueries.forEach(query => {
  const ranking = result.rankings.find(r => r.query === query);
  if (ranking && !ranking.serpFeatures.featuredSnippetIsOurs) {
    console.log(`  - ${query} (currently position ${ranking.position})`);
  }
});
```

### Competitor Analysis

```typescript
// Get competitor insights
const competitorAnalysis = result.competitorAnalysis;

// Overall performance
competitorAnalysis.competitors.forEach(comp => {
  console.log(`${comp.domain}:`);
  console.log(`  - Queries ranking: ${comp.queriesRanking}`);
  console.log(`  - Average position: ${comp.averagePosition.toFixed(1)}`);
  console.log(`  - Wins against us: ${comp.winsAgainstUs}`);
  console.log(`  - Losses to us: ${comp.lossesToUs}`);
});

// Where competitors dominate
competitorAnalysis.dominanceMap.forEach((queries, competitor) => {
  console.log(`\n${competitor} dominates in:`);
  queries.slice(0, 5).forEach(q => console.log(`  - ${q}`));
});
```

### AI Visibility Prediction

```typescript
const aiVisibility = result.aiVisibilityPrediction;

console.log(`Overall AI Visibility Score: ${aiVisibility.overallScore}/100`);

// Citation likelihood breakdown
console.log('Citation Likelihood Distribution:');
console.log(`  High (>70%): ${aiVisibility.citationLikelihood.high.toFixed(1)}% of queries`);
console.log(`  Medium (40-70%): ${aiVisibility.citationLikelihood.medium.toFixed(1)}% of queries`);
console.log(`  Low (<40%): ${aiVisibility.citationLikelihood.low.toFixed(1)}% of queries`);

// Strengths and weaknesses
console.log('\nStrengths:');
aiVisibility.strengths.forEach(s => console.log(`  + ${s}`));

console.log('\nWeaknesses:');
aiVisibility.weaknesses.forEach(w => console.log(`  - ${w}`));

// Improvement recommendations
console.log('\nTop Improvements:');
aiVisibility.improvements.slice(0, 3).forEach(imp => {
  console.log(`  - ${imp.action}`);
  console.log(`    Impact: ${imp.impact}`);
  console.log(`    Potential score increase: ${imp.potentialScore - imp.currentScore} points`);
});
```

### Pattern Recognition

```typescript
// Analyze patterns
const patterns = result.patterns;

// Performance by query type
patterns.byQueryType.forEach((pattern, queryType) => {
  console.log(`\n${queryType} Queries:`);
  console.log(`  Average position: ${pattern.averagePosition.toFixed(1)}`);
  console.log(`  Ranking rate: ${(pattern.rankingRate * 100).toFixed(0)}%`);
  console.log(`  Top 3 positions: ${pattern.topPositions}`);
});

// Content gaps
console.log('\nTop Content Gaps:');
patterns.contentGaps.slice(0, 5).forEach(gap => {
  console.log(`  - ${gap.query}`);
  console.log(`    Competitors: ${gap.competitorCount}`);
  console.log(`    Difficulty: ${gap.estimatedDifficulty}/10`);
  console.log(`    Opportunity: ${gap.opportunityScore}/100`);
});
```

### Opportunity Identification

```typescript
const opportunities = result.opportunities;

// Low hanging fruit
console.log('Low Hanging Fruit (positions 11-20):');
opportunities.lowHangingFruit.forEach(opp => {
  console.log(`  - ${opp.query} (position ${opp.currentPosition})`);
  console.log(`    Effort: ${opp.estimatedEffort}`);
  console.log(`    Traffic gain: +${opp.potentialTrafficGain} visits/month`);
  opp.recommendations.forEach(rec => console.log(`    • ${rec}`));
});

// Featured snippet opportunities
console.log('\nFeatured Snippet Opportunities:');
opportunities.featuredSnippetOpportunities.forEach(opp => {
  console.log(`  - ${opp.query} (position ${opp.currentPosition})`);
  console.log(`    Current holder: ${opp.currentSnippetHolder}`);
  console.log(`    Type: ${opp.snippetType}`);
});

// Content recommendations
console.log('\nContent Priorities:');
opportunities.contentRecommendations.forEach(rec => {
  console.log(`  - ${rec.description}`);
  console.log(`    Type: ${rec.type}`);
  console.log(`    Priority: ${rec.priority}`);
  console.log(`    Impact: ${rec.estimatedImpact}/10`);
});
```

### Historical Comparison

```typescript
// Compare with previous analysis
const snapshots = analyzer.getSnapshots();
if (snapshots.length > 1) {
  const comparison = analyzer.compareWithSnapshot(
    snapshots[1].id, // Previous snapshot
    result.rankings   // Current rankings
  );
  
  console.log('\nRanking Changes:');
  console.log(`  Improved: ${comparison.summary.improved}`);
  console.log(`  Declined: ${comparison.summary.declined}`);
  console.log(`  New rankings: ${comparison.summary.gained}`);
  console.log(`  Lost rankings: ${comparison.summary.lost}`);
  
  // Top changes
  console.log('\nBiggest Changes:');
  comparison.changes.slice(0, 5).forEach(change => {
    const direction = change.change < 0 ? '↑' : '↓';
    console.log(`  ${change.query}: ${change.previousPosition || 'NR'} → ${change.currentPosition || 'NR'} ${direction}`);
  });
}
```

## Data Models

### Core Types

```typescript
interface PositionResult {
  query: string;
  queryType: QueryType;
  position: number | null;
  url: string | null;
  isHomepage: boolean;
  multipleUrls: UrlPosition[];
  serpFeatures: SerpFeaturePresence;
  competitorPositions: CompetitorPosition[];
  visibilityScore: VisibilityScore;
  timestamp: Date;
}

interface VisibilityScore {
  position: number | null;
  clickThroughRate: number;
  serpFeatureBoost: number;
  competitorCount: number;
  visibilityScore: number;      // 0-100
  aiCitationLikelihood: number; // 0-100
}
```

### Analysis Results

```typescript
interface RankingAnalysisResult {
  domain: string;
  totalQueries: number;
  queriesAnalyzed: number;
  rankings: PositionResult[];
  summary: RankingSummary;
  patterns: RankingPatterns;
  opportunities: RankingOpportunities;
  competitorAnalysis: CompetitorSummary;
  aiVisibilityPrediction: AIVisibilityAnalysis;
}
```

## AI Visibility Algorithm

The AI citation likelihood is calculated using multiple factors:

1. **Position-Based Score** (35% weight)
   - Top 3: 90% base likelihood
   - 4-6: 70% base likelihood
   - 7-10: 50% base likelihood
   - 11-15: 30% base likelihood
   - 16-20: 20% base likelihood

2. **SERP Features** (25% weight)
   - Featured snippet ownership: +95%
   - Knowledge panel: +85%
   - People Also Ask: +15%
   - Video/Image presence: +10%

3. **Query Type Modifiers** (25% weight)
   - Informational: +10%
   - Comparison: +15%
   - Long-tail: +20%
   - Transactional: -10%

4. **Competition** (15% weight)
   - No competitors above: +10%
   - 3-5 competitors above: -10%
   - Many competitors: -20%

## Performance Metrics

### CTR Curves
Based on industry-standard data:
- Position 1: 28.23% CTR
- Position 2: 15.06% CTR
- Position 3: 10.11% CTR
- Position 10: 1.76% CTR

### Visibility Scoring
- Position value: 1-100 points based on position
- SERP feature impact: ±40 points
- Competition penalty: -5 points per competitor above

## Best Practices

### 1. Query Selection
- Include diverse query types
- Focus on high-value commercial queries
- Don't forget long-tail variations
- Include competitor comparison queries

### 2. Competitor Selection
- Choose 3-5 main competitors
- Include both direct and indirect competitors
- Consider regional competitors if relevant
- Update competitor list quarterly

### 3. Analysis Frequency
- Weekly for competitive industries
- Bi-weekly for most businesses
- Monthly for stable industries
- Daily during campaigns

### 4. Action Prioritization
1. Fix content gaps for brand queries
2. Target featured snippets for informational queries
3. Improve positions 11-20 (low hanging fruit)
4. Create content for high-opportunity gaps
5. Build authority for competitive queries

## Troubleshooting

### Common Issues

**"Multiple URLs ranking for same query"**
- Indicates potential cannibalization
- Consider consolidating content
- Implement proper canonicalization

**"Low AI visibility despite good rankings"**
- Check SERP feature ownership
- Improve content structure
- Target more informational queries

**"High competitor overlap"**
- Normal for competitive industries
- Focus on differentiation
- Target unique long-tail queries

## Advanced Features

### Custom Scoring

```typescript
// Override default scoring weights
const customConfig = {
  ...config,
  scoringWeights: {
    position: 0.4,
    serpFeatures: 0.3,
    authority: 0.2,
    competition: 0.1
  }
};
```

### Pattern Detection

```typescript
// Custom pattern detection
analyzer.on('pattern:detected', (pattern) => {
  if (pattern.type === 'sudden-drop') {
    console.warn(`Sudden ranking drop detected for ${pattern.queries.length} queries`);
  }
});
```

### Bulk Analysis

```typescript
// Analyze multiple domains
const domains = ['domain1.com', 'domain2.com'];
const results = await Promise.all(
  domains.map(domain => 
    analyzer.analyzeRankings(queries, searchResults)
  )
);
```

## Integration

### With Search Intelligence Service

```typescript
import { SearchIntelligenceService } from '../search-intelligence-service';

const searchIntel = new SearchIntelligenceService();
searchIntel.on('rankings:analyzed', (data) => {
  // Access ranking analysis results
  console.log(data.analysis.summary);
});
```

### With Web Crawler

```typescript
// Ranking analysis runs automatically after crawl
const crawlJob = await crawler.startCrawl({
  url: 'https://example.com',
  searchIntelOptions: {
    analyzeRankings: true,
    trackCompetitors: true
  }
});
```

## Testing

```bash
# Run tests
npm test ranking-analyzer-v2.test.ts

# Test specific features
npm test -- --testNamePattern="AI Visibility"

# Coverage
npm run test:coverage
```

## Performance Optimization

- **Batch Processing**: Process up to 100 queries concurrently
- **Memory Efficient**: Streaming for large result sets
- **Caching**: Results cached for 24 hours
- **Compression**: Snapshots compressed with gzip

## Future Enhancements

- [ ] Real-time ranking monitoring
- [ ] Ranking prediction models
- [ ] Automated opportunity alerts
- [ ] Custom SERP feature detection
- [ ] International ranking support
- [ ] Mobile vs Desktop analysis

## License

Part of RankMyBrand.ai platform - see main LICENSE file.