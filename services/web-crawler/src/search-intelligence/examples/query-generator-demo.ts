/**
 * Query Generator Demo
 * Demonstrates the enhanced query generation capabilities
 */

import { QueryGenerator } from '../core/query-generator-v2.js';
import { 
  QueryGenerationContext, 
  QueryGeneratorConfig 
} from '../types/search-intelligence.types.js';

async function runDemo() {
  const generator = new QueryGenerator();
  
  console.log('=== Enhanced Query Generator Demo ===\n');
  
  // Example 1: Technology SaaS Company
  console.log('1. Technology SaaS Company Example:');
  console.log('-----------------------------------');
  
  const techContext: QueryGenerationContext = {
    brand: 'DataSync Pro',
    domain: 'datasyncpro.com',
    industry: 'technology',
    products: ['Real-time Data Sync', 'API Gateway', 'Data Analytics'],
    competitors: ['Zapier', 'Integromat', 'Workato'],
    targetAudience: ['developers', 'data engineers', 'IT managers'],
    customModifiers: ['enterprise', 'cloud-based', 'real-time', 'secure']
  };
  
  const techQueries = await generator.generateQueries(techContext);
  
  console.log(`Generated ${techQueries.length} queries:\n`);
  
  // Show top 10 queries with details
  techQueries.slice(0, 10).forEach((query, index) => {
    console.log(`${index + 1}. "${query.query}"`);
    console.log(`   Type: ${query.type} | Intent: ${query.intent} | Priority: ${query.priority}`);
    console.log(`   Difficulty: ${query.expectedDifficulty}/10 | AI Relevance: ${query.aiRelevance}/10`);
    console.log(`   Purpose: ${query.expectedIntent}\n`);
  });
  
  // Analyze portfolio
  const techAnalysis = generator.analyzeQueryPortfolio(techQueries);
  console.log('Portfolio Analysis:');
  console.log('Insights:', techAnalysis.insights);
  console.log('Recommendations:', techAnalysis.recommendations);
  console.log('Type Coverage:', techAnalysis.coverage);
  console.log('\n');
  
  // Example 2: E-commerce Fashion Brand
  console.log('2. E-commerce Fashion Brand Example:');
  console.log('------------------------------------');
  
  const ecomContext: QueryGenerationContext = {
    brand: 'TrendyStyles',
    domain: 'trendystyles.com',
    industry: 'ecommerce',
    products: ['Women\'s Dresses', 'Men\'s Suits', 'Accessories', 'Shoes'],
    competitors: ['ASOS', 'Zara', 'H&M'],
    targetMarket: 'United States',
    targetAudience: ['fashion enthusiasts', 'young professionals', 'millennials'],
    customModifiers: ['sustainable', 'affordable', 'trendy', 'fast fashion']
  };
  
  const ecomConfig: QueryGeneratorConfig = {
    minQueries: 15,
    maxQueries: 25,
    includeCompetitors: true,
    includeLocation: true,
    industry: 'ecommerce'
  };
  
  const ecomQueries = await generator.generateQueriesWithConfig(ecomContext, ecomConfig);
  
  console.log(`Generated ${ecomQueries.length} queries:\n`);
  
  // Group by type
  const queryTypes = new Map<string, string[]>();
  ecomQueries.forEach(q => {
    if (!queryTypes.has(q.type)) {
      queryTypes.set(q.type, []);
    }
    queryTypes.get(q.type)!.push(q.query);
  });
  
  queryTypes.forEach((queries, type) => {
    console.log(`${type.toUpperCase()} Queries (${queries.length}):`);
    queries.slice(0, 3).forEach(q => console.log(`  - "${q}"`));
    if (queries.length > 3) console.log(`  ... and ${queries.length - 3} more`);
    console.log();
  });
  
  // Example 3: Healthcare Provider
  console.log('3. Healthcare Provider Example:');
  console.log('-------------------------------');
  
  const healthContext: QueryGenerationContext = {
    brand: 'CareFirst Medical',
    domain: 'carefirstmedical.com',
    industry: 'healthcare',
    products: ['Primary Care', 'Urgent Care', 'Telemedicine', 'Preventive Care'],
    targetMarket: 'San Francisco Bay Area',
    targetAudience: ['patients', 'families', 'seniors', 'working professionals']
  };
  
  const healthQueries = await generator.generateQueries(healthContext);
  
  // Show AI-focused queries
  const aiRelevantQueries = healthQueries
    .filter(q => q.aiRelevance >= 9)
    .sort((a, b) => b.aiRelevance - a.aiRelevance);
  
  console.log(`Top AI-Relevant Queries (${aiRelevantQueries.length} with score 9+):\n`);
  aiRelevantQueries.slice(0, 5).forEach(query => {
    console.log(`- "${query.query}" (AI Score: ${query.aiRelevance}/10)`);
  });
  console.log();
  
  // Example 4: Minimal Context (Edge Case)
  console.log('4. Minimal Context Example:');
  console.log('---------------------------');
  
  const minimalContext: QueryGenerationContext = {
    brand: 'QuickBrand',
    domain: 'quickbrand.com'
  };
  
  const minimalQueries = await generator.generateQueries(minimalContext);
  console.log(`Generated ${minimalQueries.length} queries with minimal context\n`);
  
  // Show query distribution
  const priorityDist = { high: 0, medium: 0, low: 0 };
  minimalQueries.forEach(q => {
    priorityDist[q.priority]++;
  });
  
  console.log('Priority Distribution:');
  console.log(`  High: ${priorityDist.high} queries`);
  console.log(`  Medium: ${priorityDist.medium} queries`);
  console.log(`  Low: ${priorityDist.low} queries`);
  console.log();
  
  // Example 5: Custom Configuration
  console.log('5. Custom Configuration Example:');
  console.log('--------------------------------');
  
  const customContext: QueryGenerationContext = {
    brand: 'EcoTech Solutions',
    domain: 'ecotechsolutions.com',
    industry: 'technology',
    products: ['Solar Panels', 'Smart Thermostats', 'Energy Analytics'],
    targetAudience: ['homeowners', 'businesses', 'environmentalists']
  };
  
  // Get optimal config
  const optimalConfig = generator.getOptimalConfig(customContext);
  console.log('Optimal Configuration:', optimalConfig);
  
  // Generate with custom config
  const customConfig: QueryGeneratorConfig = {
    minQueries: 5,
    maxQueries: 30,
    includeCompetitors: false, // No competitors analysis
    includeLocation: true,
    customModifiers: ['eco-friendly', 'sustainable', 'energy-efficient', 'green']
  };
  
  const customQueries = await generator.generateQueriesWithConfig(customContext, customConfig);
  
  // Show long-tail conversational queries
  const longTailQueries = customQueries.filter(q => q.type === 'long-tail');
  console.log(`\nGenerated ${longTailQueries.length} long-tail conversational queries:`);
  longTailQueries.slice(0, 5).forEach(q => {
    console.log(`- "${q.query}"`);
  });
  
  // Summary Statistics
  console.log('\n=== Summary Statistics ===');
  console.log('-------------------------');
  
  const allExamples = [
    { name: 'Technology SaaS', queries: techQueries },
    { name: 'E-commerce Fashion', queries: ecomQueries },
    { name: 'Healthcare Provider', queries: healthQueries },
    { name: 'Minimal Context', queries: minimalQueries },
    { name: 'Custom Config', queries: customQueries }
  ];
  
  allExamples.forEach(example => {
    const avgDifficulty = example.queries.reduce((sum, q) => sum + q.expectedDifficulty, 0) / example.queries.length;
    const avgAiRelevance = example.queries.reduce((sum, q) => sum + q.aiRelevance, 0) / example.queries.length;
    const highPriorityPct = (example.queries.filter(q => q.priority === 'high').length / example.queries.length * 100).toFixed(1);
    
    console.log(`${example.name}:`);
    console.log(`  Total Queries: ${example.queries.length}`);
    console.log(`  Avg Difficulty: ${avgDifficulty.toFixed(1)}/10`);
    console.log(`  Avg AI Relevance: ${avgAiRelevance.toFixed(1)}/10`);
    console.log(`  High Priority: ${highPriorityPct}%`);
    console.log();
  });
}

// Run the demo
runDemo().catch(console.error);