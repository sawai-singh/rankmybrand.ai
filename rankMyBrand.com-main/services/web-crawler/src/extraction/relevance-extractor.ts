import * as cheerio from 'cheerio';
import { RelevanceData, KeywordMatch } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class RelevanceExtractor {
  private static readonly IMPORTANT_LOCATIONS = {
    title: 5,
    h1: 3,
    h2: 2,
    h3: 1.5,
    metaDescription: 2,
    firstParagraph: 1.5,
    strongOrEm: 1.2,
    anchor: 1.1
  };

  static async extract(
    content: { text: string; html: string },
    targetKeywords: string[],
    semanticContext: Record<string, any> = {}
  ): Promise<RelevanceData> {
    const relevance: RelevanceData = {
      keywordMatches: {},
      semanticScore: 0,
      topicalCoverage: 0,
      contextAlignment: 0,
      overall: 0
    };

    try {
      const $ = cheerio.load(content.html);
      const text = content.text.toLowerCase();
      
      // Extract keyword matches with position weighting
      relevance.keywordMatches = this.extractKeywordMatches($, text, targetKeywords);
      
      // Calculate semantic score
      const semanticAnalysis = this.calculateSemanticScore(text, targetKeywords, semanticContext);
      relevance.semanticScore = semanticAnalysis.score;
      
      // Calculate topical coverage
      const topicalAnalysis = this.analyzeTopicalCoverage(text, targetKeywords);
      relevance.topicalCoverage = topicalAnalysis.coverage;
      
      // Calculate context alignment
      relevance.contextAlignment = this.assessContextAlignment(content, semanticContext);
      
      // Calculate overall relevance score
      relevance.overall = this.calculateOverallScore(relevance, targetKeywords.length);
      
      logger.debug(`Relevance extraction complete: Overall score ${relevance.overall.toFixed(1)}`);
      
    } catch (error) {
      logger.error(`Error extracting relevance: ${error}`);
    }

    return relevance;
  }

  private static extractKeywordMatches(
    $: cheerio.CheerioAPI,
    text: string,
    targetKeywords: string[]
  ): Record<string, KeywordMatch> {
    const matches: Record<string, KeywordMatch> = {};
    
    for (const keyword of targetKeywords) {
      const keywordLower = keyword.toLowerCase();
      const pattern = new RegExp(`\\b${this.escapeRegex(keywordLower)}\\b`, 'gi');
      
      let count = 0;
      let weightedScore = 0;
      
      // Check title
      const title = $('title').text().toLowerCase();
      if (title.includes(keywordLower)) {
        const titleMatches = (title.match(pattern) || []).length;
        count += titleMatches;
        weightedScore += titleMatches * this.IMPORTANT_LOCATIONS.title;
      }
      
      // Check meta description
      const metaDesc = $('meta[name="description"]').attr('content')?.toLowerCase() || '';
      if (metaDesc.includes(keywordLower)) {
        const metaMatches = (metaDesc.match(pattern) || []).length;
        count += metaMatches;
        weightedScore += metaMatches * this.IMPORTANT_LOCATIONS.metaDescription;
      }
      
      // Check H1
      $('h1').each((_, elem) => {
        const h1Text = $(elem).text().toLowerCase();
        if (h1Text.includes(keywordLower)) {
          const h1Matches = (h1Text.match(pattern) || []).length;
          count += h1Matches;
          weightedScore += h1Matches * this.IMPORTANT_LOCATIONS.h1;
        }
      });
      
      // Check H2
      $('h2').each((_, elem) => {
        const h2Text = $(elem).text().toLowerCase();
        if (h2Text.includes(keywordLower)) {
          const h2Matches = (h2Text.match(pattern) || []).length;
          count += h2Matches;
          weightedScore += h2Matches * this.IMPORTANT_LOCATIONS.h2;
        }
      });
      
      // Check H3
      $('h3').each((_, elem) => {
        const h3Text = $(elem).text().toLowerCase();
        if (h3Text.includes(keywordLower)) {
          const h3Matches = (h3Text.match(pattern) || []).length;
          count += h3Matches;
          weightedScore += h3Matches * this.IMPORTANT_LOCATIONS.h3;
        }
      });
      
      // Check first paragraph
      const firstP = $('p').first().text().toLowerCase();
      if (firstP.includes(keywordLower)) {
        const firstPMatches = (firstP.match(pattern) || []).length;
        count += firstPMatches;
        weightedScore += firstPMatches * this.IMPORTANT_LOCATIONS.firstParagraph;
      }
      
      // Check emphasized text
      $('strong, em, b, i').each((_, elem) => {
        const emphText = $(elem).text().toLowerCase();
        if (emphText.includes(keywordLower)) {
          const emphMatches = (emphText.match(pattern) || []).length;
          count += emphMatches;
          weightedScore += emphMatches * this.IMPORTANT_LOCATIONS.strongOrEm;
        }
      });
      
      // Count in body text
      const bodyMatches = (text.match(pattern) || []).length;
      count = bodyMatches; // Total count
      weightedScore += bodyMatches; // Add base score for body matches
      
      matches[keyword] = {
        count,
        weightedScore
      };
    }
    
    return matches;
  }

  private static calculateSemanticScore(
    text: string,
    targetKeywords: string[],
    semanticContext: Record<string, any>
  ): { score: number; topTerms: string[] } {
    // Simple TF-IDF-like calculation
    const words = text.split(/\s+/).filter(word => word.length > 3);
    const wordFreq: Record<string, number> = {};
    
    // Calculate term frequency
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });
    
    // Normalize frequencies
    const maxFreq = Math.max(...Object.values(wordFreq));
    Object.keys(wordFreq).forEach(word => {
      wordFreq[word] = wordFreq[word] / maxFreq;
    });
    
    // Find related terms
    const relatedTerms = this.findRelatedTerms(targetKeywords, wordFreq);
    
    // Calculate semantic score based on presence of related terms
    let semanticScore = 0;
    let matchedTerms = 0;
    
    relatedTerms.forEach(term => {
      if (wordFreq[term]) {
        semanticScore += wordFreq[term];
        matchedTerms++;
      }
    });
    
    // Normalize score
    const normalizedScore = matchedTerms > 0 ? semanticScore / matchedTerms : 0;
    
    // Get top terms
    const topTerms = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([term]) => term);
    
    return {
      score: Math.min(normalizedScore, 1),
      topTerms
    };
  }

  private static findRelatedTerms(
    keywords: string[],
    wordFreq: Record<string, number>
  ): string[] {
    const related = new Set<string>();
    
    // Common variations and related terms
    const variations: Record<string, string[]> = {
      'ai': ['artificial', 'intelligence', 'machine', 'learning', 'neural', 'deep'],
      'seo': ['search', 'engine', 'optimization', 'ranking', 'google', 'serp'],
      'geo': ['generative', 'engine', 'optimization', 'llm', 'chatgpt', 'claude'],
      'content': ['article', 'post', 'page', 'text', 'writing', 'copy'],
      'optimize': ['optimization', 'improve', 'enhance', 'boost', 'increase'],
      'rank': ['ranking', 'position', 'visibility', 'appear', 'show'],
      'website': ['site', 'page', 'domain', 'url', 'web'],
      'tool': ['software', 'platform', 'application', 'service', 'system']
    };
    
    keywords.forEach(keyword => {
      const keyLower = keyword.toLowerCase();
      
      // Add the keyword itself
      related.add(keyLower);
      
      // Add simple variations
      related.add(keyLower + 's'); // plural
      related.add(keyLower + 'ing'); // gerund
      related.add(keyLower + 'ed'); // past tense
      
      // Add known related terms
      if (variations[keyLower]) {
        variations[keyLower].forEach(term => related.add(term));
      }
      
      // Find compound terms in the text
      Object.keys(wordFreq).forEach(word => {
        if (word.includes(keyLower) || keyLower.includes(word)) {
          related.add(word);
        }
      });
    });
    
    return Array.from(related);
  }

  private static analyzeTopicalCoverage(
    text: string,
    targetKeywords: string[]
  ): { coverage: number; concepts: string[] } {
    const concepts = new Set<string>();
    const patterns = {
      definition: /(?:is|are|means?|refers? to|defined as|known as)/i,
      example: /(?:for example|such as|including|like|for instance|e\.g\.)/i,
      comparison: /(?:compared to|versus|vs\.?|unlike|similar to|different from)/i,
      causation: /(?:because|therefore|consequently|as a result|due to|leads to)/i,
      process: /(?:how to|steps|process|method|approach|technique)/i,
      benefits: /(?:benefits?|advantages?|pros|helps?|improves?)/i,
      features: /(?:features?|characteristics?|properties|attributes?)/i,
      types: /(?:types?|kinds?|categories|forms?|varieties)/i
    };
    
    // Find sentences containing target keywords
    const sentences = text.split(/[.!?]+/);
    const keywordSentences = sentences.filter(sentence => 
      targetKeywords.some(kw => 
        sentence.toLowerCase().includes(kw.toLowerCase())
      )
    );
    
    // Check for concept indicators in keyword sentences
    keywordSentences.forEach(sentence => {
      Object.entries(patterns).forEach(([type, pattern]) => {
        if (pattern.test(sentence)) {
          concepts.add(type);
        }
      });
    });
    
    // Check for comprehensive coverage indicators
    const coverageIndicators = {
      hasDefinition: concepts.has('definition'),
      hasExamples: concepts.has('example'),
      hasComparison: concepts.has('comparison'),
      hasProcess: concepts.has('process'),
      hasBenefits: concepts.has('benefits'),
      hasTypes: concepts.has('types')
    };
    
    // Calculate coverage score
    const indicatorCount = Object.values(coverageIndicators).filter(Boolean).length;
    const maxIndicators = Object.keys(coverageIndicators).length;
    const coverage = indicatorCount / maxIndicators;
    
    return {
      coverage,
      concepts: Array.from(concepts)
    };
  }

  private static assessContextAlignment(
    content: { text: string; html: string },
    semanticContext: Record<string, any>
  ): number {
    const $ = cheerio.load(content.html);
    const text = content.text.toLowerCase();
    
    // Detect content type
    const contentType = this.detectContentType(text);
    
    // Define expected patterns for different content types
    const expectedPatterns: Record<string, Record<string, boolean>> = {
      informational: {
        hasDefinition: /(?:what is|definition|meaning of|refers to)/i.test(text),
        hasExplanation: /(?:how|why|when|where)/i.test(text),
        hasConclusion: $('h2:contains("Conclusion"), .conclusion').length > 0,
        hasStructure: $('h2').length >= 2
      },
      tutorial: {
        hasSteps: /(?:step \d+|first|next|then|finally)/i.test(text),
        hasInstructions: /(?:how to|guide|tutorial|follow these)/i.test(text),
        hasCode: $('code, pre').length > 0,
        hasExamples: /(?:example|sample|demo)/i.test(text)
      },
      comparison: {
        hasComparison: /(?:vs|versus|compared to|difference between)/i.test(text),
        hasProsAndCons: /(?:pros|cons|advantages|disadvantages|benefits|drawbacks)/i.test(text),
        hasTable: $('table').length > 0,
        hasConclusion: /(?:better|best|recommend|choose)/i.test(text)
      },
      review: {
        hasRating: /(?:rating|score|stars?|points?)/i.test(text),
        hasOpinion: /(?:think|believe|feel|opinion|experience)/i.test(text),
        hasProsAndCons: /(?:pros|cons|like|dislike)/i.test(text),
        hasRecommendation: /(?:recommend|worth|buy|avoid)/i.test(text)
      }
    };
    
    // Check alignment with expected patterns
    const patterns = expectedPatterns[contentType] || expectedPatterns.informational;
    const matches = Object.values(patterns).filter(Boolean).length;
    const total = Object.keys(patterns).length;
    
    return matches / total;
  }

  private static detectContentType(text: string): string {
    const indicators = {
      informational: /(?:what is|learn about|understanding|guide to|introduction|overview)/i,
      tutorial: /(?:how to|step by step|tutorial|instructions|diy|guide)/i,
      comparison: /(?:vs|versus|compare|which is better|difference between)/i,
      review: /(?:review|rating|experience|tested|tried|opinion)/i,
      news: /(?:breaking|update|announces?|reports?|according to)/i,
      analysis: /(?:analysis|study|research|findings|data shows)/i
    };
    
    for (const [type, pattern] of Object.entries(indicators)) {
      if (pattern.test(text)) {
        return type;
      }
    }
    
    return 'informational'; // default
  }

  private static calculateOverallScore(
    relevance: RelevanceData,
    keywordCount: number
  ): number {
    // Calculate keyword score
    const keywordScore = keywordCount > 0
      ? Object.values(relevance.keywordMatches)
          .reduce((sum, match) => sum + Math.min(match.weightedScore / 10, 10), 0) / keywordCount
      : 0;
    
    // Normalize scores to 0-1 range
    const normalizedKeywordScore = Math.min(keywordScore / 10, 1);
    
    // Weight different components
    const weights = {
      keyword: 0.3,
      semantic: 0.3,
      topical: 0.2,
      context: 0.2
    };
    
    // Calculate weighted average
    const overall = (
      normalizedKeywordScore * weights.keyword +
      relevance.semanticScore * weights.semantic +
      relevance.topicalCoverage * weights.topical +
      relevance.contextAlignment * weights.context
    ) * 100;
    
    return Math.max(0, Math.min(100, overall));
  }

  private static escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  static generateRelevanceReport(
    relevance: RelevanceData,
    targetKeywords: string[]
  ): {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    keywordGaps: string[];
  } {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const opportunities: string[] = [];
    const keywordGaps: string[] = [];
    
    // Analyze keyword performance
    targetKeywords.forEach(keyword => {
      const match = relevance.keywordMatches[keyword];
      if (match) {
        if (match.count === 0) {
          keywordGaps.push(keyword);
        } else if (match.weightedScore < 5) {
          weaknesses.push(`Low prominence for keyword "${keyword}"`);
          opportunities.push(`Move "${keyword}" to title, headings, or early paragraphs`);
        } else if (match.weightedScore > 15) {
          strengths.push(`Strong presence of "${keyword}" in important locations`);
        }
      }
    });
    
    // Semantic analysis
    if (relevance.semanticScore > 0.7) {
      strengths.push('Excellent semantic relevance');
    } else if (relevance.semanticScore < 0.3) {
      weaknesses.push('Low semantic relevance');
      opportunities.push('Include more related terms and synonyms');
    }
    
    // Topical coverage
    if (relevance.topicalCoverage > 0.7) {
      strengths.push('Comprehensive topical coverage');
    } else if (relevance.topicalCoverage < 0.4) {
      weaknesses.push('Limited topical coverage');
      opportunities.push('Add definitions, examples, and comparisons');
    }
    
    // Context alignment
    if (relevance.contextAlignment > 0.8) {
      strengths.push('Well-aligned with content type expectations');
    } else if (relevance.contextAlignment < 0.5) {
      weaknesses.push('Content structure doesn\'t match user intent');
      opportunities.push('Restructure content to better match search intent');
    }
    
    return {
      strengths,
      weaknesses,
      opportunities,
      keywordGaps
    };
  }
}
