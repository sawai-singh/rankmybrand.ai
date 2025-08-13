import axios, { AxiosInstance } from 'axios';
import { logger } from '../lib/logger';

interface WordPressPost {
  title: string;
  content: string;
  status: 'publish' | 'draft' | 'pending' | 'private';
  categories?: number[];
  tags?: number[];
  meta?: Record<string, any>;
  featured_media?: number;
}

interface WordPressResponse {
  id: number;
  link: string;
  title: { rendered: string };
  content: { rendered: string };
  status: string;
}

export class WordPress {
  private client: AxiosInstance;
  private baseUrl: string;
  private rateLimiter: Map<string, number>;

  constructor() {
    this.baseUrl = process.env.WORDPRESS_URL || '';
    
    if (!this.baseUrl) {
      logger.warn('WordPress URL not configured');
    }
    
    this.client = axios.create({
      baseURL: `${this.baseUrl}/wp-json/wp/v2`,
      auth: {
        username: process.env.WORDPRESS_USER || '',
        password: process.env.WORDPRESS_APP_PASSWORD || ''
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    this.rateLimiter = new Map();
  }

  async createPost(post: WordPressPost): Promise<WordPressResponse> {
    await this.checkRateLimit('posts');
    
    try {
      const response = await this.client.post('/posts', {
        title: post.title,
        content: post.content,
        status: post.status,
        categories: post.categories,
        tags: post.tags,
        meta: post.meta
      });
      
      logger.info(`Created WordPress post: ${response.data.id}`);
      return response.data;
      
    } catch (error) {
      logger.error('Failed to create WordPress post:', error);
      throw this.handleError(error);
    }
  }

  async updatePost(postId: number, updates: Partial<WordPressPost>): Promise<WordPressResponse> {
    await this.checkRateLimit('posts');
    
    try {
      const response = await this.client.put(`/posts/${postId}`, updates);
      logger.info(`Updated WordPress post: ${postId}`);
      return response.data;
      
    } catch (error) {
      logger.error(`Failed to update WordPress post ${postId}:`, error);
      throw this.handleError(error);
    }
  }

  async deletePost(postId: number): Promise<void> {
    await this.checkRateLimit('posts');
    
    try {
      await this.client.delete(`/posts/${postId}`);
      logger.info(`Deleted WordPress post: ${postId}`);
      
    } catch (error) {
      logger.error(`Failed to delete WordPress post ${postId}:`, error);
      throw this.handleError(error);
    }
  }

  async updatePostMeta(params: {
    postId: number;
    meta: Record<string, any>;
  }): Promise<any> {
    await this.checkRateLimit('meta');
    
    try {
      // Update post with meta fields
      const response = await this.client.put(`/posts/${params.postId}`, {
        meta: params.meta
      });
      
      logger.info(`Updated meta for post ${params.postId}`);
      return response.data;
      
    } catch (error) {
      logger.error(`Failed to update meta for post ${params.postId}:`, error);
      throw this.handleError(error);
    }
  }

  async updateSchema(params: {
    pageId?: number;
    schema: string;
  }): Promise<any> {
    await this.checkRateLimit('schema');
    
    try {
      // Update schema through custom endpoint or meta field
      if (params.pageId) {
        return await this.updatePostMeta({
          postId: params.pageId,
          meta: {
            _schema_markup: params.schema
          }
        });
      }
      
      // Global schema update
      const response = await this.client.post('/settings', {
        schema_markup: params.schema
      });
      
      logger.info('Updated WordPress schema');
      return response.data;
      
    } catch (error) {
      logger.error('Failed to update WordPress schema:', error);
      throw this.handleError(error);
    }
  }

  async createPage(page: {
    title: string;
    content: string;
    status: string;
    template?: string;
  }): Promise<WordPressResponse> {
    await this.checkRateLimit('pages');
    
    try {
      const response = await this.client.post('/pages', {
        title: page.title,
        content: page.content,
        status: page.status,
        template: page.template
      });
      
      logger.info(`Created WordPress page: ${response.data.id}`);
      return response.data;
      
    } catch (error) {
      logger.error('Failed to create WordPress page:', error);
      throw this.handleError(error);
    }
  }

  async uploadMedia(params: {
    file: Buffer;
    filename: string;
    mimeType: string;
  }): Promise<any> {
    await this.checkRateLimit('media');
    
    try {
      const formData = new FormData();
      formData.append('file', new Blob([params.file]), params.filename);
      
      const response = await this.client.post('/media', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Content-Disposition': `attachment; filename="${params.filename}"`
        }
      });
      
      logger.info(`Uploaded media: ${response.data.id}`);
      return response.data;
      
    } catch (error) {
      logger.error('Failed to upload media:', error);
      throw this.handleError(error);
    }
  }

  async getCategories(): Promise<any[]> {
    try {
      const response = await this.client.get('/categories');
      return response.data;
    } catch (error) {
      logger.error('Failed to get categories:', error);
      throw this.handleError(error);
    }
  }

  async getTags(): Promise<any[]> {
    try {
      const response = await this.client.get('/tags');
      return response.data;
    } catch (error) {
      logger.error('Failed to get tags:', error);
      throw this.handleError(error);
    }
  }

  async rollback(rollbackData: any): Promise<void> {
    if (rollbackData.postId) {
      await this.deletePost(rollbackData.postId);
    }
    
    if (rollbackData.pageId) {
      await this.client.delete(`/pages/${rollbackData.pageId}`);
    }
    
    if (rollbackData.mediaId) {
      await this.client.delete(`/media/${rollbackData.mediaId}?force=true`);
    }
  }

  private async checkRateLimit(endpoint: string): Promise<void> {
    const key = `wordpress:${endpoint}`;
    const now = Date.now();
    const lastCall = this.rateLimiter.get(key) || 0;
    
    const limit = parseInt(process.env.WORDPRESS_RATE_LIMIT || '60');
    const window = parseInt(process.env.WORDPRESS_RATE_WINDOW_MS || '60000');
    const minInterval = window / limit;
    
    const timeSinceLastCall = now - lastCall;
    if (timeSinceLastCall < minInterval) {
      const waitTime = minInterval - timeSinceLastCall;
      logger.debug(`Rate limiting WordPress ${endpoint}, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.rateLimiter.set(key, Date.now());
  }

  private handleError(error: any): Error {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;
      
      if (status === 401) {
        return new Error(`WordPress authentication failed: ${message}`);
      }
      
      if (status === 403) {
        return new Error(`WordPress permission denied: ${message}`);
      }
      
      if (status === 404) {
        return new Error(`WordPress resource not found: ${message}`);
      }
      
      if (status === 429) {
        return new Error(`WordPress rate limit exceeded: ${message}`);
      }
      
      return new Error(`WordPress API error: ${message}`);
    }
    
    return error;
  }
}