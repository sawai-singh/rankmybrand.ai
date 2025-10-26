export interface CrawlJob {
  id: string;
  url: string;
  depth: number;
  userId?: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  pagesScanned?: number;
  duration?: number;
  error?: string;
  results?: any;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface PageData {
  url: string;
  title: string;
  description: string;
  keywords: string[];
  h1: string[];
  h2: string[];
  images: string[];
  links: string[];
  statusCode: number;
  contentType: string;
  size: number;
  loadTime: number;
  structuredData?: any;
  openGraph?: {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    type?: string;
  };
  crawledAt: Date;
}

export interface CrawlResult {
  jobId: string;
  pages: PageData[];
  summary: {
    totalPages: number;
    totalSize: number;
    avgLoadTime: number;
    statusCodes: Record<number, number>;
    contentTypes: Record<string, number>;
  };
}

export interface SERPResult {
  query: string;
  platform: string;
  position: number;
  totalResults: number;
  url: string;
  title: string;
  snippet: string;
  relatedSearches: string[];
  peopleAlsoAsk: string[];
  featuredSnippet?: string;
  knowledgePanel?: any;
  analyzedAt: Date;
}

export interface CompetitorAnalysis {
  domain: string;
  competitors: Array<{
    domain: string;
    name: string;
    similarity: number;
    sharedKeywords: string[];
    overlap: number;
    authority: number;
  }>;
  analyzedAt: Date;
}