import * as cheerio from 'cheerio';
import { FluencyData, ContentStructure } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class FluencyExtractor {
  private static readonly TRANSITION_WORDS = [
    'however', 'therefore', 'furthermore', 'moreover', 'consequently',
    'additionally', 'nevertheless', 'nonetheless', 'meanwhile', 'subsequently',
    'accordingly', 'hence', 'thus', 'indeed', 'likewise',
    'in addition', 'in contrast', 'on the other hand', 'for example',
    'for instance', 'in conclusion', 'to summarize', 'in summary',
    'first', 'second', 'third', 'finally', 'next', 'then',
    'as a result', 'because of this', 'due to', 'owing to'
  ];

  private static readonly AI_FRIENDLY_INDICATORS = {
    hasNumberedLists: (html: string) => /<ol[\s>]/i.test(html),
    hasBulletPoints: (html: string) => /<ul[\s>]/i.test(html),
    hasShortParagraphs: (avgLength: number) => avgLength < 100,
    hasSubheadings: (h2Count: number) => h2Count >= 3,
    hasClearStructure: (structure: ContentStructure) => structure.hasH1 && structure.h2Count > 0,
    hasKeyTakeaways: ($: cheerio.CheerioAPI) => {
      const selectors = ['.key-takeaways', '.tldr', '.summary', '.highlights', '.key-points'];
      return selectors.some(sel => $(sel).length > 0);
    },
    usesTransitionPhrases: (text: string) => {
      const lowerText = text.toLowerCase();
      const transitionCount = FluencyExtractor.TRANSITION_WORDS.filter(word => 
        lowerText.includes(word)
      ).length;
      return transitionCount >= 3;
    },
    hasDefinitions: (text: string) => {
      const definitionPatterns = [
        /\bis defined as\b/i,
        /\bmeans\b/i,
        /\brefers to\b/i,
        /\bcan be described as\b/i
      ];
      return definitionPatterns.some(pattern => pattern.test(text));
    }
  };

  static extract(text: string, html: string): FluencyData {
    const fluency: FluencyData = {
      readabilityScores: {
        fleschKincaid: 0,
        gunningFog: 0
      },
      structure: {
        hasH1: false,
        h2Count: 0,
        h3Count: 0,
        paragraphCount: 0,
        listCount: 0,
        avgParagraphLength: 0,
        hasTableOfContents: false,
        hasConclusion: false
      },
      overall: 0,
      aiOptimized: false
    };

    try {
      // Clean text for analysis
      const cleanText = this.cleanTextForAnalysis(text);
      const sentences = this.extractSentences(cleanText);
      const words = this.extractWords(cleanText);
      
      // Calculate readability scores
      fluency.readabilityScores = this.calculateReadabilityScores(sentences, words, cleanText);
      
      // Analyze structure
      const $ = cheerio.load(html);
      fluency.structure = this.analyzeStructure($);
      
      // Check AI optimization
      fluency.aiOptimized = this.checkAIOptimization($, html, text, fluency.structure);
      
      // Calculate overall score
      fluency.overall = this.calculateOverallScore(fluency);
      
      logger.debug(`Fluency extraction complete: Overall score ${fluency.overall.toFixed(1)}, AI optimized: ${fluency.aiOptimized}`);
      
    } catch (error) {
      logger.error(`Error extracting fluency: ${error}`);
    }

    return fluency;
  }

  private static cleanTextForAnalysis(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/["""'']/g, '"')
      .replace(/[–—]/g, '-')
      .trim();
  }

  private static extractSentences(text: string): string[] {
    // Split by sentence-ending punctuation
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    
    // Filter out very short sentences (likely abbreviations)
    return sentences.filter(sentence => {
      const words = sentence.trim().split(/\s+/);
      return words.length >= 3;
    });
  }

  private static extractWords(text: string): string[] {
    // Extract words (alphanumeric sequences)
    return text.match(/\b[a-zA-Z0-9]+\b/g) || [];
  }

  private static calculateReadabilityScores(
    sentences: string[], 
    words: string[], 
    text: string
  ): { fleschKincaid: number; gunningFog: number } {
    const totalWords = words.length;
    const totalSentences = Math.max(sentences.length, 1);
    const totalSyllables = this.countTotalSyllables(words);
    
    // Flesch-Kincaid Reading Ease
    // Score = 206.835 - 1.015(total words/total sentences) - 84.6(total syllables/total words)
    const avgSentenceLength = totalWords / totalSentences;
    const avgSyllablesPerWord = totalSyllables / Math.max(totalWords, 1);
    const fleschKincaid = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
    
    // Gunning Fog Index
    // Score = 0.4 * ((words/sentences) + 100 * (complex words/words))
    const complexWords = words.filter(word => this.countSyllables(word) > 2).length;
    const complexWordPercentage = (complexWords / Math.max(totalWords, 1)) * 100;
    const gunningFog = 0.4 * (avgSentenceLength + complexWordPercentage);
    
    return {
      fleschKincaid: Math.max(0, Math.min(100, fleschKincaid)),
      gunningFog: Math.max(0, gunningFog)
    };
  }

  private static countSyllables(word: string): number {
    word = word.toLowerCase().trim();
    
    // Special cases
    if (word.length <= 3) return 1;
    if (word.endsWith('e')) word = word.slice(0, -1);
    
    // Count vowel groups
    const vowelGroups = word.match(/[aeiouy]+/g) || [];
    let count = vowelGroups.length;
    
    // Adjust for special patterns
    if (word.endsWith('le') && word.length > 2) count++;
    if (count === 0) count = 1;
    
    return count;
  }

  private static countTotalSyllables(words: string[]): number {
    return words.reduce((total, word) => total + this.countSyllables(word), 0);
  }

  private static analyzeStructure($: cheerio.CheerioAPI): ContentStructure {
    const structure: ContentStructure = {
      hasH1: $('h1').length > 0,
      h2Count: $('h2').length,
      h3Count: $('h3').length,
      paragraphCount: $('p').length,
      listCount: $('ul, ol').length,
      avgParagraphLength: 0,
      hasTableOfContents: false,
      hasConclusion: false
    };
    
    // Calculate average paragraph length
    const paragraphLengths = $('p').map((_, elem) => {
      const text = $(elem).text().trim();
      return text.split(/\s+/).filter(w => w.length > 0).length;
    }).get();
    
    if (paragraphLengths.length > 0) {
      const totalWords = paragraphLengths.reduce((sum, len) => sum + len, 0);
      structure.avgParagraphLength = totalWords / paragraphLengths.length;
    }
    
    // Check for table of contents
    const tocSelectors = [
      '#toc', '#table-of-contents', '.toc', '.table-of-contents',
      '[class*="toc"]', '[id*="toc"]', 'nav.contents'
    ];
    structure.hasTableOfContents = tocSelectors.some(sel => $(sel).length > 0);
    
    // Check for conclusion
    const conclusionSelectors = [
      'h2:contains("Conclusion")', 'h2:contains("Summary")', 
      'h3:contains("Conclusion")', 'h3:contains("Summary")',
      '.conclusion', '.summary', '#conclusion', '#summary',
      'section[class*="conclusion"]', 'section[class*="summary"]'
    ];
    structure.hasConclusion = conclusionSelectors.some(sel => $(sel).length > 0);
    
    return structure;
  }

  private static checkAIOptimization(
    $: cheerio.CheerioAPI, 
    html: string, 
    text: string, 
    structure: ContentStructure
  ): boolean {
    const indicators = {
      hasNumberedLists: this.AI_FRIENDLY_INDICATORS.hasNumberedLists(html),
      hasBulletPoints: this.AI_FRIENDLY_INDICATORS.hasBulletPoints(html),
      hasShortParagraphs: this.AI_FRIENDLY_INDICATORS.hasShortParagraphs(structure.avgParagraphLength),
      hasSubheadings: this.AI_FRIENDLY_INDICATORS.hasSubheadings(structure.h2Count),
      hasClearStructure: this.AI_FRIENDLY_INDICATORS.hasClearStructure(structure),
      hasKeyTakeaways: this.AI_FRIENDLY_INDICATORS.hasKeyTakeaways($),
      usesTransitionPhrases: this.AI_FRIENDLY_INDICATORS.usesTransitionPhrases(text),
      hasDefinitions: this.AI_FRIENDLY_INDICATORS.hasDefinitions(text)
    };
    
    // Count positive indicators
    const positiveIndicators = Object.values(indicators).filter(Boolean).length;
    
    // AI-optimized if at least 4 indicators are present
    return positiveIndicators >= 4;
  }

  private static calculateOverallScore(fluency: FluencyData): number {
    // Readability score (0-100)
    const readabilityScore = Math.max(0, Math.min(100, fluency.readabilityScores.fleschKincaid));
    
    // Structure score components
    let structureScore = 0;
    
    // Basic structure elements (40 points)
    if (fluency.structure.hasH1) structureScore += 10;
    structureScore += Math.min(fluency.structure.h2Count * 5, 20); // Max 20 points for H2s
    if (fluency.structure.hasTableOfContents) structureScore += 10;
    
    // Paragraph optimization (20 points)
    if (fluency.structure.avgParagraphLength > 0 && fluency.structure.avgParagraphLength < 150) {
      structureScore += 10;
    }
    if (fluency.structure.paragraphCount >= 5) {
      structureScore += 10;
    }
    
    // Lists and formatting (20 points)
    if (fluency.structure.listCount > 0) {
      structureScore += Math.min(fluency.structure.listCount * 5, 10);
    }
    if (fluency.structure.hasConclusion) {
      structureScore += 10;
    }
    
    // AI optimization bonus (20 points)
    if (fluency.aiOptimized) {
      structureScore += 20;
    }
    
    // Combine scores (50% readability, 50% structure)
    const overall = (readabilityScore * 0.5) + (structureScore * 0.5);
    
    return Math.max(0, Math.min(100, overall));
  }

  static generateFluencyReport(fluency: FluencyData): {
    strengths: string[];
    weaknesses: string[];
    aiReadiness: {
      score: number;
      missing: string[];
    };
  } {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const missingForAI: string[] = [];
    
    // Readability analysis
    if (fluency.readabilityScores.fleschKincaid >= 60) {
      strengths.push('Good readability score (easy to understand)');
    } else if (fluency.readabilityScores.fleschKincaid < 30) {
      weaknesses.push('Very difficult readability - simplify sentences');
    }
    
    if (fluency.readabilityScores.gunningFog <= 12) {
      strengths.push('Appropriate complexity level');
    } else {
      weaknesses.push('High complexity - reduce jargon and complex words');
    }
    
    // Structure analysis
    if (fluency.structure.hasH1) {
      strengths.push('Clear main heading');
    } else {
      weaknesses.push('Missing H1 heading');
      missingForAI.push('Add a clear H1 heading');
    }
    
    if (fluency.structure.h2Count >= 3) {
      strengths.push('Well-structured with subheadings');
    } else {
      weaknesses.push('Insufficient subheadings');
      missingForAI.push('Add more H2 subheadings to break up content');
    }
    
    if (fluency.structure.avgParagraphLength < 100) {
      strengths.push('Concise paragraphs');
    } else {
      weaknesses.push('Paragraphs too long');
      missingForAI.push('Break up long paragraphs');
    }
    
    if (fluency.structure.listCount > 0) {
      strengths.push('Uses lists for clarity');
    } else {
      missingForAI.push('Add bullet points or numbered lists');
    }
    
    if (fluency.structure.hasTableOfContents) {
      strengths.push('Has table of contents');
    }
    
    if (fluency.structure.hasConclusion) {
      strengths.push('Clear conclusion/summary');
    } else {
      missingForAI.push('Add a conclusion or summary section');
    }
    
    // AI optimization
    if (fluency.aiOptimized) {
      strengths.push('Optimized for AI consumption');
    } else {
      weaknesses.push('Not optimized for AI engines');
    }
    
    // Calculate AI readiness score
    const aiReadinessScore = fluency.aiOptimized ? 80 : 40 + (5 - missingForAI.length) * 8;
    
    return {
      strengths,
      weaknesses,
      aiReadiness: {
        score: Math.max(0, Math.min(100, aiReadinessScore)),
        missing: missingForAI
      }
    };
  }

  static suggestImprovements(fluency: FluencyData): string[] {
    const suggestions: string[] = [];
    
    // Readability improvements
    if (fluency.readabilityScores.fleschKincaid < 50) {
      suggestions.push('Shorten sentences to improve readability (aim for 15-20 words per sentence)');
      suggestions.push('Replace complex words with simpler alternatives');
    }
    
    if (fluency.readabilityScores.gunningFog > 12) {
      suggestions.push('Reduce the use of words with 3+ syllables');
    }
    
    // Structure improvements
    if (!fluency.structure.hasH1) {
      suggestions.push('Add a clear, descriptive H1 heading at the beginning');
    }
    
    if (fluency.structure.h2Count < 3) {
      suggestions.push(`Add ${3 - fluency.structure.h2Count} more H2 subheadings to improve structure`);
    }
    
    if (fluency.structure.avgParagraphLength > 150) {
      suggestions.push('Break long paragraphs into shorter ones (aim for 50-100 words)');
    }
    
    if (fluency.structure.listCount === 0) {
      suggestions.push('Convert key points into bullet or numbered lists');
    }
    
    if (!fluency.structure.hasConclusion) {
      suggestions.push('Add a conclusion section summarizing key points');
    }
    
    // AI optimization
    if (!fluency.aiOptimized) {
      suggestions.push('Add a "Key Takeaways" or "TL;DR" section at the beginning');
      suggestions.push('Use transition phrases to connect ideas clearly');
      suggestions.push('Include definitions for technical terms');
    }
    
    return suggestions;
  }
}
