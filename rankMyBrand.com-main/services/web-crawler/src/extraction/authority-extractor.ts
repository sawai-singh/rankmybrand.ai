import * as cheerio from 'cheerio';
import { URL } from 'url';
import { AuthorityData, AuthoritySignals } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class AuthorityExtractor {
  private static readonly TRUSTED_DOMAINS = [
    '.edu', '.gov', '.org',
    'wikipedia.org', 'scholar.google.com',
    'pubmed.ncbi.nlm.nih.gov', 'nature.com',
    'sciencedirect.com', 'ieee.org',
    'acm.org', 'springer.com'
  ];

  private static readonly AUTHORITY_INDICATORS = {
    credentials: [
      'Ph.D', 'PhD', 'M.D', 'MD', 'Dr.', 'Doctor', 'Professor', 'Prof.',
      'MBA', 'CPA', 'JD', 'Esq', 'RN', 'MSN', 'MPH', 'MS', 'MA',
      'Licensed', 'Certified', 'Board-certified', 'Fellow'
    ],
    institutions: [
      'University', 'Institute', 'College', 'Academy', 'School',
      'Hospital', 'Medical Center', 'Research', 'Laboratory',
      'Foundation', 'Association', 'Society', 'Council'
    ],
    publications: [
      'Journal', 'Review', 'Proceedings', 'Transactions',
      'Letters', 'Communications', 'Reports', 'Bulletin'
    ]
  };

  static async extract(url: string, html: string): Promise<AuthorityData> {
    const authority: AuthorityData = {
      signals: {
        https: false,
        wwwSubdomain: false,
        hasAboutPage: false,
        hasContactPage: false,
        hasPrivacyPolicy: false,
        hasTermsOfService: false,
        hasAuthorSchema: false,
        hasAuthorBio: false,
        authorName: null,
        socialLinks: {
          twitter: false,
          linkedin: false,
          facebook: false,
          youtube: false
        },
        socialCount: 0,
        externalLinkCount: 0,
        authorityLinks: 0,
        hasOrganizationSchema: false,
        hasArticleSchema: false
      },
      score: 0,
      confidence: 0
    };

    try {
      const $ = cheerio.load(html);
      const parsedUrl = new URL(url);
      const domain = parsedUrl.hostname;
      
      // Technical signals
      authority.signals.https = parsedUrl.protocol === 'https:';
      authority.signals.wwwSubdomain = domain.startsWith('www.');
      
      // Extract all signals
      this.extractNavigationSignals($, authority.signals);
      this.extractAuthorSignals($, authority.signals);
      this.extractSocialSignals($, domain, authority.signals);
      this.extractLinkSignals($, domain, authority.signals);
      this.extractSchemaSignals($, authority.signals);
      
      // Additional trust signals
      const additionalSignals = this.extractAdditionalTrustSignals($, domain);
      
      // Calculate score
      authority.score = this.calculateAuthorityScore(authority.signals, additionalSignals);
      
      // Calculate confidence
      authority.confidence = this.calculateConfidence(authority.signals);
      
      logger.debug(`Authority extraction complete: Score ${authority.score}, Confidence ${authority.confidence.toFixed(2)}`);
      
    } catch (error) {
      logger.error(`Error extracting authority signals: ${error}`);
    }

    return authority;
  }

  private static extractNavigationSignals($: cheerio.CheerioAPI, signals: AuthoritySignals): void {
    // Check for about page
    const aboutSelectors = [
      'a[href*="/about"]', 'a[href*="about-us"]', 'a[href*="about.html"]',
      'a:contains("About")', 'a:contains("About Us")'
    ];
    signals.hasAboutPage = this.elementExists($, aboutSelectors);
    
    // Check for contact page
    const contactSelectors = [
      'a[href*="/contact"]', 'a[href*="contact-us"]', 'a[href*="contact.html"]',
      'a:contains("Contact")', 'a:contains("Contact Us")'
    ];
    signals.hasContactPage = this.elementExists($, contactSelectors);
    
    // Check for privacy policy
    const privacySelectors = [
      'a[href*="/privacy"]', 'a[href*="privacy-policy"]',
      'a:contains("Privacy")', 'a:contains("Privacy Policy")'
    ];
    signals.hasPrivacyPolicy = this.elementExists($, privacySelectors);
    
    // Check for terms of service
    const termsSelectors = [
      'a[href*="/terms"]', 'a[href*="terms-of-service"]', 'a[href*="/tos"]',
      'a:contains("Terms")', 'a:contains("Terms of Service")', 'a:contains("Terms of Use")'
    ];
    signals.hasTermsOfService = this.elementExists($, termsSelectors);
  }

  private static extractAuthorSignals($: cheerio.CheerioAPI, signals: AuthoritySignals): void {
    // Check for author schema
    const schemas = $('script[type="application/ld+json"]');
    schemas.each((_, elem) => {
      const schemaText = $(elem).text();
      if (/@type.*Person|"author"/i.test(schemaText)) {
        signals.hasAuthorSchema = true;
      }
      if (/@type.*Organization/i.test(schemaText)) {
        signals.hasOrganizationSchema = true;
      }
      if (/@type.*Article/i.test(schemaText)) {
        signals.hasArticleSchema = true;
      }
    });
    
    // Check for author bio
    const authorBioSelectors = [
      '.author-bio', '.author-info', '.author-description',
      '[class*="author-bio"]', '[class*="author-info"]',
      '.about-author', '#author-bio', '.writer-bio'
    ];
    signals.hasAuthorBio = this.elementExists($, authorBioSelectors);
    
    // Extract author name
    signals.authorName = this.extractAuthorName($);
  }

  private static extractSocialSignals($: cheerio.CheerioAPI, domain: string, signals: AuthoritySignals): void {
    // Check for social media links
    const socialPatterns = {
      twitter: /twitter\.com|x\.com/i,
      linkedin: /linkedin\.com/i,
      facebook: /facebook\.com/i,
      youtube: /youtube\.com/i
    };
    
    $('a[href*="://"]').each((_, elem) => {
      const href = $(elem).attr('href') || '';
      
      for (const [platform, pattern] of Object.entries(socialPatterns)) {
        if (pattern.test(href) && !href.includes(domain)) {
          signals.socialLinks[platform as keyof typeof signals.socialLinks] = true;
        }
      }
    });
    
    // Count active social platforms
    signals.socialCount = Object.values(signals.socialLinks).filter(Boolean).length;
    
    // Check for social sharing buttons
    const shareButtons = $(
      '[class*="share"], [class*="social"], ' +
      '[id*="share"], [id*="social"], ' +
      '[data-share], .addthis_toolbox'
    ).length;
    
    if (shareButtons > 0 && signals.socialCount === 0) {
      // Has share buttons but no direct social links
      signals.socialCount = 0.5; // Partial credit
    }
  }

  private static extractLinkSignals($: cheerio.CheerioAPI, domain: string, signals: AuthoritySignals): void {
    const externalLinks = $('a[href^="http"]:not([href*="' + domain + '"])');
    signals.externalLinkCount = externalLinks.length;
    
    // Count authority links
    let authorityLinkCount = 0;
    externalLinks.each((_, elem) => {
      const href = $(elem).attr('href') || '';
      
      // Check if link is to a trusted domain
      if (this.TRUSTED_DOMAINS.some(trusted => href.includes(trusted))) {
        authorityLinkCount++;
      }
      
      // Check for academic/research links
      const academicPatterns = [
        /doi\.org/i,
        /arxiv\.org/i,
        /researchgate\.net/i,
        /academia\.edu/i,
        /ssrn\.com/i
      ];
      
      if (academicPatterns.some(pattern => pattern.test(href))) {
        authorityLinkCount++;
      }
    });
    
    signals.authorityLinks = authorityLinkCount;
  }

  private static extractSchemaSignals($: cheerio.CheerioAPI, signals: AuthoritySignals): void {
    // Already extracted in extractAuthorSignals, but we can do additional checks here
    
    // Check for microdata
    if ($('[itemscope][itemtype*="schema.org"]').length > 0) {
      const hasPersonMicrodata = $('[itemtype*="Person"]').length > 0;
      const hasOrgMicrodata = $('[itemtype*="Organization"]').length > 0;
      const hasArticleMicrodata = $('[itemtype*="Article"]').length > 0;
      
      signals.hasAuthorSchema = signals.hasAuthorSchema || hasPersonMicrodata;
      signals.hasOrganizationSchema = signals.hasOrganizationSchema || hasOrgMicrodata;
      signals.hasArticleSchema = signals.hasArticleSchema || hasArticleMicrodata;
    }
  }

  private static extractAdditionalTrustSignals($: cheerio.CheerioAPI, domain: string): Record<string, any> {
    const additional: Record<string, any> = {};
    
    // Check for SSL certificate info (would need actual SSL check in production)
    additional.hasExtendedValidation = false; // Would check cert type
    
    // Check for trust badges
    const trustBadgePatterns = [
      'norton', 'mcafee', 'truste', 'bbb', 'verisign',
      'ssl-certificate', 'secure-site', 'verified'
    ];
    additional.hasTrustBadges = trustBadgePatterns.some(pattern => 
      $(`img[src*="${pattern}"], img[alt*="${pattern}"]`).length > 0
    );
    
    // Check for professional associations
    additional.hasProfessionalAssociations = this.AUTHORITY_INDICATORS.institutions.some(inst => 
      $('body').text().includes(inst)
    );
    
    // Check domain age indicator (copyright years)
    const copyrightMatch = $('body').text().match(/(?:©|Copyright)\s*(\d{4})/i);
    if (copyrightMatch) {
      const year = parseInt(copyrightMatch[1]);
      const currentYear = new Date().getFullYear();
      additional.apparentAge = currentYear - year;
    }
    
    // Check for awards/recognition
    const awardPatterns = ['award', 'certified', 'accredited', 'recognized', 'featured in'];
    additional.hasAwards = awardPatterns.some(pattern => 
      $(`[class*="${pattern}"], [id*="${pattern}"]`).length > 0
    );
    
    return additional;
  }

  private static elementExists($: cheerio.CheerioAPI, selectors: string[]): boolean {
    return selectors.some(selector => {
      try {
        return $(selector).length > 0;
      } catch {
        // Some selectors might be invalid for certain content
        return false;
      }
    });
  }

  private static extractAuthorName($: cheerio.CheerioAPI): string | null {
    // Try multiple strategies to extract author name
    const strategies = [
      // Meta tag
      () => $('meta[name="author"]').attr('content'),
      // Schema.org
      () => {
        const schema = $('script[type="application/ld+json"]').text();
        const match = schema.match(/"author":\s*{[^}]*"name":\s*"([^"]+)"/);
        return match ? match[1] : null;
      },
      // Byline patterns
      () => $('.author-name, .by-author, .article-author, [itemprop="author"]').first().text(),
      // Rel author
      () => $('[rel="author"]').first().text(),
      // Common patterns in text
      () => {
        const bylineMatch = $('body').text().match(/[Bb]y\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
        return bylineMatch ? bylineMatch[1] : null;
      }
    ];
    
    for (const strategy of strategies) {
      const author = strategy();
      if (author && author.trim()) {
        return author.trim();
      }
    }
    
    return null;
  }

  private static calculateAuthorityScore(
    signals: AuthoritySignals, 
    additional: Record<string, any>
  ): number {
    let score = 0;
    
    // Technical signals (20 points)
    if (signals.https) score += 10;
    if (signals.wwwSubdomain) score += 5;
    if (additional.hasTrustBadges) score += 5;
    
    // Navigation/Policy signals (20 points)
    if (signals.hasAboutPage) score += 5;
    if (signals.hasContactPage) score += 5;
    if (signals.hasPrivacyPolicy) score += 5;
    if (signals.hasTermsOfService) score += 5;
    
    // Author signals (20 points)
    if (signals.hasAuthorSchema || signals.hasAuthorBio) score += 10;
    if (signals.authorName) score += 10;
    
    // Social signals (15 points)
    score += Math.min(signals.socialCount * 3, 15);
    
    // Link authority (15 points)
    score += Math.min(signals.authorityLinks * 3, 15);
    
    // Schema signals (10 points)
    if (signals.hasOrganizationSchema) score += 5;
    if (signals.hasArticleSchema) score += 5;
    
    // Additional trust signals (bonus points)
    if (additional.hasProfessionalAssociations) score += 5;
    if (additional.hasAwards) score += 5;
    if (additional.apparentAge && additional.apparentAge > 5) score += 5;
    
    return Math.min(score, 100);
  }

  private static calculateConfidence(signals: AuthoritySignals): number {
    // Count how many signals we were able to extract
    const totalPossibleSignals = 14; // Number of boolean signals
    let extractedSignals = 0;
    
    const booleanSignals = [
      signals.https, signals.wwwSubdomain, signals.hasAboutPage,
      signals.hasContactPage, signals.hasPrivacyPolicy, signals.hasTermsOfService,
      signals.hasAuthorSchema, signals.hasAuthorBio, signals.socialLinks.twitter,
      signals.socialLinks.linkedin, signals.socialLinks.facebook, signals.socialLinks.youtube,
      signals.hasOrganizationSchema, signals.hasArticleSchema
    ];
    
    extractedSignals = booleanSignals.filter(Boolean).length;
    
    // Add partial confidence for other extracted data
    if (signals.authorName) extractedSignals += 0.5;
    if (signals.externalLinkCount > 0) extractedSignals += 0.5;
    
    return extractedSignals / totalPossibleSignals;
  }

  static analyzeAuthorityWeaknesses(authority: AuthorityData): {
    critical: string[];
    important: string[];
    minor: string[];
  } {
    const critical: string[] = [];
    const important: string[] = [];
    const minor: string[] = [];
    
    // Critical issues
    if (!authority.signals.https) {
      critical.push('Website does not use HTTPS (major trust issue)');
    }
    
    // Important issues
    if (!authority.signals.hasAboutPage && !authority.signals.hasContactPage) {
      important.push('No About or Contact page found');
    }
    if (!authority.signals.hasPrivacyPolicy) {
      important.push('Missing privacy policy');
    }
    if (!authority.signals.authorName && !authority.signals.hasAuthorBio) {
      important.push('No author information provided');
    }
    if (authority.signals.authorityLinks === 0) {
      important.push('No links to authoritative sources');
    }
    
    // Minor issues
    if (authority.signals.socialCount === 0) {
      minor.push('No social media presence detected');
    }
    if (!authority.signals.hasOrganizationSchema && !authority.signals.hasArticleSchema) {
      minor.push('Missing structured data markup');
    }
    if (!authority.signals.wwwSubdomain) {
      minor.push('Consider using www subdomain for consistency');
    }
    
    return { critical, important, minor };
  }
}
