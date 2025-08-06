class RankMyBrandGEO {
    constructor(apiUrl = 'http://localhost:8000/api/v1') {
        this.apiUrl = apiUrl;
    }
    
    /**
     * Analyze content for GEO score
     * @param {Object} params - Analysis parameters
     * @returns {Promise<Object>} GEO analysis results
     */
    async analyzeContent(params) {
        const response = await fetch(`${this.apiUrl}/geo/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(params)
        });
        
        if (!response.ok) {
            throw new Error(`Analysis failed: ${response.statusText}`);
        }
        
        return response.json();
    }
    
    /**
     * Get domain analysis history
     * @param {string} domain - Domain to check
     * @returns {Promise<Object>} Historical analysis data
     */
    async getDomainHistory(domain) {
        const response = await fetch(`${this.apiUrl}/geo/analysis/${domain}`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch domain history: ${response.statusText}`);
        }
        
        return response.json();
    }
    
    /**
     * Batch analyze multiple URLs
     * @param {Array<string>} urls - URLs to analyze
     * @returns {Promise<Object>} Batch job information
     */
    async batchAnalyze(urls) {
        const response = await fetch(`${this.apiUrl}/geo/analyze/batch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ urls })
        });
        
        if (!response.ok) {
            throw new Error(`Batch analysis failed: ${response.statusText}`);
        }
        
        return response.json();
    }
    
    /**
     * Get trending metrics
     * @returns {Promise<Object>} Trending GEO metrics
     */
    async getTrendingMetrics() {
        const response = await fetch(`${this.apiUrl}/geo/trending`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch trending metrics: ${response.statusText}`);
        }
        
        return response.json();
    }
}

// Usage example
const geoClient = new RankMyBrandGEO('https://geo.rankmybrand.ai/api/v1');

// Analyze single page
geoClient.analyzeContent({
    url: 'https://example.com/page',
    content: 'Your content here...',
    brand_terms: ['brand', 'product'],
    target_queries: ['best widgets', 'widget reviews'],
    check_ai_visibility: true
}).then(result => {
    console.log('GEO Score:', result.geo_score);
    console.log('Recommendations:', result.recommendations);
}).catch(error => {
    console.error('Analysis error:', error);
});
