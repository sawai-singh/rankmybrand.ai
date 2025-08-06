import { describe, it, expect } from '@jest/globals';
import { CitationExtractor } from '../src/extraction/citation-extractor';

describe('CitationExtractor', () => {
  describe('extract', () => {
    it('should detect numeric citations', () => {
      const html = `
        <article>
          <p>Studies show that AI adoption has increased [1]. 
          Another research confirms this trend [2].</p>
          <section class="references">
            <h2>References</h2>
            <ol>
              <li>Smith, J. (2023). AI Adoption Trends.</li>
              <li>Johnson, K. (2023). Technology Growth.</li>
            </ol>
          </section>
        </article>
      `;
      const text = 'Studies show that AI adoption has increased [1]. Another research confirms this trend [2].';
      
      const result = CitationExtractor.extract(html, text);
      
      expect(result.count).toBeGreaterThan(0);
      expect(result.hasReferenceSection).toBe(true);
      expect(result.types.numeric).toBeGreaterThan(0);
    });

    it('should detect author-year citations', () => {
      const html = '<p>According to Smith (2023), AI is transforming industries.</p>';
      const text = 'According to Smith (2023), AI is transforming industries.';
      
      const result = CitationExtractor.extract(html, text);
      
      expect(result.count).toBeGreaterThan(0);
      expect(result.types.authorYear).toBeGreaterThan(0);
    });

    it('should calculate citation density', () => {
      const html = `
        <p>Research shows [1] that citations [2] improve credibility [3].</p>
      `;
      const text = 'Research shows [1] that citations [2] improve credibility [3].';
      
      const result = CitationExtractor.extract(html, text);
      
      expect(result.density).toBeGreaterThan(0);
      expect(result.density).toBeLessThan(100);
    });

    it('should detect reference sections', () => {
      const htmlWithRefs = `
        <div class="references">
          <h2>Bibliography</h2>
          <ul>
            <li>Source 1</li>
            <li>Source 2</li>
          </ul>
        </div>
      `;
      
      const htmlWithoutRefs = '<p>Just some text without references.</p>';
      
      const resultWithRefs = CitationExtractor.extract(htmlWithRefs, 'text');
      const resultWithoutRefs = CitationExtractor.extract(htmlWithoutRefs, 'text');
      
      expect(resultWithRefs.hasReferenceSection).toBe(true);
      expect(resultWithoutRefs.hasReferenceSection).toBe(false);
    });

    it('should calculate confidence score', () => {
      const html = `
        <article>
          <p>Multiple studies [1][2][3] support this claim.</p>
          <div id="references">
            <h2>References</h2>
            <ol>
              <li>Study 1</li>
              <li>Study 2</li>
              <li>Study 3</li>
            </ol>
          </div>
        </article>
      `;
      const text = 'Multiple studies [1][2][3] support this claim.';
      
      const result = CitationExtractor.extract(html, text);
      
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should handle empty content gracefully', () => {
      const result = CitationExtractor.extract('', '');
      
      expect(result.count).toBe(0);
      expect(result.hasReferenceSection).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('should extract detailed citations', () => {
      const html = `
        <article>
          <p>Research by Smith et al. [1] shows improvement.</p>
          <p>Johnson (2023) argues differently [2].</p>
        </article>
      `;
      
      const detailed = CitationExtractor.extractDetailedCitations(html);
      
      expect(detailed.citations).toBeInstanceOf(Array);
      expect(detailed.references).toBeInstanceOf(Array);
    });
  });
});
