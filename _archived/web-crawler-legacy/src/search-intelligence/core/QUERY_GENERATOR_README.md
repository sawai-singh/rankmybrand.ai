# Enhanced Query Generator

The Enhanced Query Generator is an intelligent system that creates 10-20 highly relevant search queries based on a company's brand, products, and services. It's designed to maximize visibility in both traditional search engines and AI-powered search systems.

## Features

### 🎯 Intelligent Query Generation
- **7 Query Types**: Brand, Product, Service, Transactional, Informational, Comparison, Long-tail
- **4 Intent Categories**: Commercial, Informational, Navigational, Transactional
- **AI-Focused Scoring**: Predicts likelihood of queries being used in AI search (1-10 scale)
- **Difficulty Estimation**: Estimates ranking difficulty for each query (1-10 scale)

### 🏭 Industry-Specific Templates
Pre-configured templates for:
- Technology/SaaS
- E-commerce
- Healthcare
- Finance

### 🔧 Advanced Configuration
```typescript
interface QueryGeneratorConfig {
  minQueries: number;      // Default: 10
  maxQueries: number;      // Default: 20
  includeCompetitors: boolean;
  includeLocation: boolean;
  targetAudience?: string[];
  industry?: string;
  customModifiers?: string[];
}
```

### 🧠 NLP-Based Entity Extraction
- Automatically extracts products, services, features from context
- Identifies problems, tools, and solutions mentioned
- Adapts query generation based on extracted entities

## Usage

### Basic Usage
```typescript
import { QueryGenerator } from './query-generator-v2.js';

const generator = new QueryGenerator();

const context = {
  brand: 'YourBrand',
  domain: 'yourbrand.com',
  industry: 'technology',
  products: ['Product A', 'Product B'],
  competitors: ['Competitor1', 'Competitor2']
};

const queries = await generator.generateQueries(context);
```

### Advanced Usage with Configuration
```typescript
const config: QueryGeneratorConfig = {
  minQueries: 15,
  maxQueries: 25,
  includeCompetitors: true,
  includeLocation: true,
  targetAudience: ['developers', 'startups'],
  customModifiers: ['open-source', 'enterprise']
};

const queries = await generator.generateQueriesWithConfig(context, config);
```

### Analyzing Query Portfolio
```typescript
const analysis = generator.analyzeQueryPortfolio(queries);
console.log(analysis.insights);        // Strengths of the portfolio
console.log(analysis.recommendations); // Improvement suggestions
console.log(analysis.coverage);        // Type distribution
```

## Query Types Explained

### 1. Brand Queries
Focus on brand discovery and reputation
- Examples: "YourBrand", "YourBrand reviews", "is YourBrand worth it"
- High AI relevance for brand research

### 2. Product Queries
Target specific product searches
- Examples: "best product YourBrand", "YourBrand product pricing"
- Include buying intent and research queries

### 3. Service Queries
For service-based businesses
- Examples: "YourBrand services", "hire YourBrand"
- Location-aware when applicable

### 4. Transactional Queries
High commercial intent
- Examples: "buy YourBrand", "YourBrand free trial"
- Lower AI relevance but high conversion value

### 5. Informational Queries
Educational and how-to content
- Examples: "how to use YourBrand", "what is YourBrand"
- Highest AI relevance scores

### 6. Comparison Queries
Competitive analysis queries
- Examples: "YourBrand vs Competitor", "YourBrand alternatives"
- Very high AI relevance for decision-making

### 7. Long-tail Queries
Natural language questions
- Examples: "how does YourBrand help with specific problem"
- Optimized for AI search engines

## Scoring System

### AI Relevance (1-10)
Predicts likelihood of query appearing in AI-generated responses:
- **9-10**: Very likely to be used by AI (conversational, informational)
- **7-8**: Likely to be used (comparison, research)
- **5-6**: Moderate likelihood (transactional, navigational)
- **1-4**: Less likely (pure navigational, very specific)

### Expected Difficulty (1-10)
Estimates competition level:
- **1-3**: Easy (branded terms, long-tail)
- **4-6**: Moderate (product-specific, informational)
- **7-8**: Difficult (generic terms, high competition)
- **9-10**: Very difficult (single words, broad terms)

### Priority Levels
- **High**: Critical for visibility and conversions
- **Medium**: Important for comprehensive coverage
- **Low**: Nice to have, fills gaps

## Best Practices

### 1. Provide Rich Context
```typescript
const richContext = {
  brand: 'DataSync Pro',
  domain: 'datasyncpro.com',
  industry: 'technology',
  products: ['API Gateway', 'Data Pipeline', 'Analytics Dashboard'],
  competitors: ['Zapier', 'MuleSoft', 'Segment'],
  targetAudience: ['developers', 'data engineers', 'CTOs'],
  targetMarket: 'United States',
  customModifiers: ['real-time', 'enterprise', 'secure']
};
```

### 2. Use Industry Templates
The generator automatically applies industry-specific patterns when you specify the industry.

### 3. Balance Query Types
Aim for a diverse portfolio:
- 20% Brand queries
- 20% Informational queries
- 15% Long-tail queries
- 15% Product/Service queries
- 15% Comparison queries (if competitors exist)
- 10% Transactional queries
- 5% Local queries (if applicable)

### 4. Iterate and Refine
Use the portfolio analysis to identify gaps and adjust your configuration.

## Examples

### Technology SaaS
```typescript
// Input
{
  brand: 'CloudAPI Pro',
  industry: 'technology',
  products: ['REST API', 'GraphQL API', 'Webhooks']
}

// Output examples
"CloudAPI Pro" (Brand, AI: 9/10)
"how to integrate CloudAPI Pro with existing systems" (Long-tail, AI: 10/10)
"CloudAPI Pro vs Postman" (Comparison, AI: 10/10)
"CloudAPI Pro API documentation" (Informational, AI: 8/10)
```

### E-commerce
```typescript
// Input
{
  brand: 'FashionHub',
  industry: 'ecommerce',
  products: ['Women\'s Clothing', 'Accessories'],
  targetMarket: 'New York'
}

// Output examples
"FashionHub reviews" (Brand, AI: 8/10)
"buy women's clothing online FashionHub" (Transactional, AI: 7/10)
"FashionHub New York" (Local, AI: 6/10)
"FashionHub size guide" (Informational, AI: 7/10)
```

## Performance

- Generates 20 queries in <100ms
- Memory efficient with streaming generation
- No external API calls required
- Deterministic results with same input

## Testing

Run the comprehensive test suite:
```bash
npm test query-generator-enhanced.test.ts
```

Run the demo:
```bash
npx ts-node examples/query-generator-demo.ts
```

## Future Enhancements

1. **Machine Learning Integration**: Train on actual SERP data for better predictions
2. **Multi-language Support**: Generate queries in different languages
3. **Seasonal Adaptation**: Adjust queries based on time of year
4. **Voice Search Optimization**: Add conversational patterns for voice search
5. **BERT Integration**: Use transformer models for better semantic understanding