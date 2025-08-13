import axios, { AxiosInstance } from 'axios';
import { logger } from '../lib/logger';

interface WebflowItem {
  collection: string;
  fields: Record<string, any>;
}

interface WebflowResponse {
  id: string;
  slug: string;
  name: string;
  _archived: boolean;
  _draft: boolean;
}

export class Webflow {
  private client: AxiosInstance;
  private siteId: string;
  private rateLimiter: Map<string, number>;

  constructor() {
    const apiKey = process.env.WEBFLOW_API_KEY || '';
    this.siteId = process.env.WEBFLOW_SITE_ID || '';
    
    if (!apiKey) {
      logger.warn('Webflow API key not configured');
    }
    
    this.client = axios.create({
      baseURL: 'https://api.webflow.com',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'accept-version': '1.0.0'
      }
    });
    
    this.rateLimiter = new Map();
  }

  async createItem(item: WebflowItem): Promise<WebflowResponse> {
    await this.checkRateLimit('items');
    
    try {
      // Get collection ID
      const collectionId = await this.getCollectionId(item.collection);
      
      const response = await this.client.post(
        `/collections/${collectionId}/items`,
        {
          fields: {
            ...item.fields,
            _archived: false,
            _draft: process.env.DRAFT_MODE_ONLY === 'true'
          }
        }
      );
      
      // Publish if not in draft mode
      if (process.env.DRAFT_MODE_ONLY !== 'true') {
        await this.publishSite();
      }
      
      logger.info(`Created Webflow item: ${response.data.id}`);
      return response.data;
      
    } catch (error) {
      logger.error('Failed to create Webflow item:', error);
      throw this.handleError(error);
    }
  }

  async updateItem(itemId: string, collectionId: string, updates: Record<string, any>): Promise<WebflowResponse> {
    await this.checkRateLimit('items');
    
    try {
      const response = await this.client.patch(
        `/collections/${collectionId}/items/${itemId}`,
        {
          fields: updates
        }
      );
      
      // Publish if not in draft mode
      if (process.env.DRAFT_MODE_ONLY !== 'true') {
        await this.publishSite();
      }
      
      logger.info(`Updated Webflow item: ${itemId}`);
      return response.data;
      
    } catch (error) {
      logger.error(`Failed to update Webflow item ${itemId}:`, error);
      throw this.handleError(error);
    }
  }

  async deleteItem(itemId: string, collectionId: string): Promise<void> {
    await this.checkRateLimit('items');
    
    try {
      await this.client.delete(`/collections/${collectionId}/items/${itemId}`);
      
      // Publish after deletion
      await this.publishSite();
      
      logger.info(`Deleted Webflow item: ${itemId}`);
      
    } catch (error) {
      logger.error(`Failed to delete Webflow item ${itemId}:`, error);
      throw this.handleError(error);
    }
  }

  async getCollections(): Promise<any[]> {
    try {
      const response = await this.client.get(`/sites/${this.siteId}/collections`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get Webflow collections:', error);
      throw this.handleError(error);
    }
  }

  private async getCollectionId(collectionName: string): Promise<string> {
    const collections = await this.getCollections();
    const collection = collections.find(c => 
      c.name.toLowerCase() === collectionName.toLowerCase() ||
      c.slug === collectionName
    );
    
    if (!collection) {
      throw new Error(`Webflow collection not found: ${collectionName}`);
    }
    
    return collection._id;
  }

  async publishSite(): Promise<void> {
    await this.checkRateLimit('publish');
    
    try {
      const response = await this.client.post(`/sites/${this.siteId}/publish`, {
        domains: [] // Publish to all domains
      });
      
      logger.info(`Published Webflow site: ${this.siteId}`);
      
    } catch (error) {
      logger.error('Failed to publish Webflow site:', error);
      // Don't throw - publishing failures shouldn't break the flow
    }
  }

  async uploadAsset(params: {
    fileName: string;
    fileData: Buffer;
  }): Promise<any> {
    await this.checkRateLimit('assets');
    
    try {
      // First, get upload URL
      const uploadResponse = await this.client.post('/sites/' + this.siteId + '/assets', {
        fileName: params.fileName,
        fileSize: params.fileData.length
      });
      
      const { uploadUrl, url } = uploadResponse.data;
      
      // Upload to S3
      await axios.put(uploadUrl, params.fileData, {
        headers: {
          'Content-Type': 'application/octet-stream'
        }
      });
      
      logger.info(`Uploaded Webflow asset: ${params.fileName}`);
      return { url };
      
    } catch (error) {
      logger.error('Failed to upload Webflow asset:', error);
      throw this.handleError(error);
    }
  }

  async rollback(rollbackData: any): Promise<void> {
    if (rollbackData.itemId && rollbackData.collectionId) {
      await this.deleteItem(rollbackData.itemId, rollbackData.collectionId);
    }
  }

  private async checkRateLimit(endpoint: string): Promise<void> {
    const key = `webflow:${endpoint}`;
    const now = Date.now();
    const lastCall = this.rateLimiter.get(key) || 0;
    
    // Webflow has a rate limit of 60 requests per minute
    const minInterval = 1000; // 1 second between calls to be safe
    
    const timeSinceLastCall = now - lastCall;
    if (timeSinceLastCall < minInterval) {
      const waitTime = minInterval - timeSinceLastCall;
      logger.debug(`Rate limiting Webflow ${endpoint}, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.rateLimiter.set(key, Date.now());
  }

  private handleError(error: any): Error {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.msg || 
                     error.response?.data?.message || 
                     error.message;
      
      if (status === 401) {
        return new Error(`Webflow authentication failed: ${message}`);
      }
      
      if (status === 403) {
        return new Error(`Webflow permission denied: ${message}`);
      }
      
      if (status === 404) {
        return new Error(`Webflow resource not found: ${message}`);
      }
      
      if (status === 429) {
        return new Error(`Webflow rate limit exceeded: ${message}`);
      }
      
      if (status === 400) {
        return new Error(`Webflow validation error: ${message}`);
      }
      
      return new Error(`Webflow API error: ${message}`);
    }
    
    return error;
  }
}