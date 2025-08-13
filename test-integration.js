#!/usr/bin/env node

/**
 * Integration Test Script for RankMyBrand.ai
 * Tests end-to-end connectivity between all services
 */

const http = require('http');
const https = require('https');
const WebSocket = require('ws');

// Service endpoints
const SERVICES = {
  gateway: 'http://localhost:4000',
  geo: 'http://localhost:8000',
  crawler: 'http://localhost:3002',
  intelligence: 'http://localhost:8002',
  action: 'http://localhost:8082',
  websocket: 'ws://localhost:3001/ws',
  gatewayWs: 'ws://localhost:4000/ws',
  dashboard: 'http://localhost:3000',
  frontend: 'http://localhost:3003',
};

// Colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

// Test results
const results = [];

/**
 * Make HTTP request
 */
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });
    
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

/**
 * Test WebSocket connection
 */
function testWebSocket(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('WebSocket timeout'));
    }, 5000);
    
    ws.on('open', () => {
      clearTimeout(timeout);
      ws.close();
      resolve(true);
    });
    
    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

/**
 * Test service health
 */
async function testServiceHealth(name, url) {
  console.log(`Testing ${name}...`);
  
  try {
    const healthUrl = `${url}/health`;
    const response = await httpRequest(healthUrl);
    
    if (response.status === 200 || response.status === 204) {
      console.log(`  ${colors.green}✓${colors.reset} ${name} is healthy`);
      results.push({ service: name, status: 'healthy', url });
      return true;
    } else {
      console.log(`  ${colors.yellow}⚠${colors.reset} ${name} returned status ${response.status}`);
      results.push({ service: name, status: 'degraded', url });
      return false;
    }
  } catch (error) {
    console.log(`  ${colors.red}✗${colors.reset} ${name} is unreachable: ${error.message}`);
    results.push({ service: name, status: 'unreachable', url, error: error.message });
    return false;
  }
}

/**
 * Test API Gateway routing
 */
async function testGatewayRouting() {
  console.log('\nTesting API Gateway routing...');
  
  const routes = [
    { path: '/api/geo/health', name: 'GEO route' },
    { path: '/api/crawler/health', name: 'Crawler route' },
    { path: '/api/intelligence/health', name: 'Intelligence route' },
    { path: '/api/actions/health', name: 'Actions route' },
  ];
  
  for (const route of routes) {
    try {
      const response = await httpRequest(`${SERVICES.gateway}${route.path}`);
      if (response.status < 500) {
        console.log(`  ${colors.green}✓${colors.reset} ${route.name} working`);
      } else {
        console.log(`  ${colors.yellow}⚠${colors.reset} ${route.name} returned ${response.status}`);
      }
    } catch (error) {
      console.log(`  ${colors.red}✗${colors.reset} ${route.name} failed: ${error.message}`);
    }
  }
}

/**
 * Test instant score analysis
 */
async function testInstantScore() {
  console.log('\nTesting instant score analysis...');
  
  try {
    const response = await httpRequest(`${SERVICES.gateway}/api/analyze/instant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { domain: 'example.com' },
    });
    
    if (response.status === 200) {
      const data = JSON.parse(response.body);
      console.log(`  ${colors.green}✓${colors.reset} Instant score working`);
      console.log(`    Score: ${data.score || 'N/A'}`);
    } else {
      console.log(`  ${colors.yellow}⚠${colors.reset} Instant score returned ${response.status}`);
    }
  } catch (error) {
    console.log(`  ${colors.red}✗${colors.reset} Instant score failed: ${error.message}`);
  }
}

/**
 * Test WebSocket connections
 */
async function testWebSockets() {
  console.log('\nTesting WebSocket connections...');
  
  // Test main WebSocket server
  try {
    await testWebSocket(SERVICES.websocket);
    console.log(`  ${colors.green}✓${colors.reset} WebSocket server connected`);
  } catch (error) {
    console.log(`  ${colors.red}✗${colors.reset} WebSocket server failed: ${error.message}`);
  }
  
  // Test Gateway WebSocket
  try {
    await testWebSocket(SERVICES.gatewayWs);
    console.log(`  ${colors.green}✓${colors.reset} Gateway WebSocket connected`);
  } catch (error) {
    console.log(`  ${colors.red}✗${colors.reset} Gateway WebSocket failed: ${error.message}`);
  }
}

/**
 * Test end-to-end data flow
 */
async function testEndToEndFlow() {
  console.log('\nTesting end-to-end data flow...');
  
  try {
    // 1. Start a crawl job
    console.log('  1. Starting crawl job...');
    const crawlResponse = await httpRequest(`${SERVICES.gateway}/api/crawler/crawl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { url: 'https://example.com', depth: 1, limit: 5 },
    });
    
    if (crawlResponse.status === 200 || crawlResponse.status === 201) {
      const crawlData = JSON.parse(crawlResponse.body);
      console.log(`    ${colors.green}✓${colors.reset} Crawl job started: ${crawlData.id || 'N/A'}`);
    }
    
    // 2. Get GEO score
    console.log('  2. Getting GEO score...');
    const geoResponse = await httpRequest(`${SERVICES.gateway}/api/geo/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { domain: 'example.com', quick: true },
    });
    
    if (geoResponse.status === 200) {
      const geoData = JSON.parse(geoResponse.body);
      console.log(`    ${colors.green}✓${colors.reset} GEO score retrieved: ${geoData.score || 'N/A'}`);
    }
    
    // 3. Test complete analysis
    console.log('  3. Running complete analysis...');
    const completeResponse = await httpRequest(`${SERVICES.gateway}/api/analyze/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { domain: 'example.com' },
    });
    
    if (completeResponse.status === 200) {
      console.log(`    ${colors.green}✓${colors.reset} Complete analysis successful`);
    }
    
    console.log(`  ${colors.green}✓${colors.reset} End-to-end flow working`);
  } catch (error) {
    console.log(`  ${colors.red}✗${colors.reset} End-to-end flow failed: ${error.message}`);
  }
}

/**
 * Generate summary report
 */
function generateReport() {
  console.log('\n' + '='.repeat(50));
  console.log('INTEGRATION TEST SUMMARY');
  console.log('='.repeat(50));
  
  const healthy = results.filter(r => r.status === 'healthy').length;
  const degraded = results.filter(r => r.status === 'degraded').length;
  const unreachable = results.filter(r => r.status === 'unreachable').length;
  
  console.log(`\nServices tested: ${results.length}`);
  console.log(`  ${colors.green}Healthy:${colors.reset} ${healthy}`);
  console.log(`  ${colors.yellow}Degraded:${colors.reset} ${degraded}`);
  console.log(`  ${colors.red}Unreachable:${colors.reset} ${unreachable}`);
  
  if (unreachable > 0) {
    console.log('\nUnreachable services:');
    results.filter(r => r.status === 'unreachable').forEach(r => {
      console.log(`  - ${r.service}: ${r.error}`);
    });
  }
  
  const successRate = (healthy / results.length * 100).toFixed(1);
  console.log(`\nOverall health: ${successRate}%`);
  
  if (successRate === '100.0') {
    console.log(`${colors.green}✅ All systems operational!${colors.reset}`);
  } else if (successRate >= 75) {
    console.log(`${colors.yellow}⚠️  System partially operational${colors.reset}`);
  } else {
    console.log(`${colors.red}❌ System experiencing issues${colors.reset}`);
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🧪 RANKMYBRAND.AI INTEGRATION TEST');
  console.log('=====================================\n');
  
  // Test individual services
  console.log('Testing individual services...');
  await testServiceHealth('API Gateway', SERVICES.gateway);
  await testServiceHealth('GEO Calculator', SERVICES.geo);
  await testServiceHealth('Web Crawler', SERVICES.crawler);
  await testServiceHealth('Intelligence Engine', SERVICES.intelligence);
  await testServiceHealth('Action Center', SERVICES.action);
  await testServiceHealth('Dashboard', SERVICES.dashboard);
  await testServiceHealth('Frontend', SERVICES.frontend);
  
  // Test gateway routing
  await testGatewayRouting();
  
  // Test instant score
  await testInstantScore();
  
  // Test WebSockets
  await testWebSockets();
  
  // Test end-to-end flow
  await testEndToEndFlow();
  
  // Generate report
  generateReport();
}

// Run tests
runTests().catch(console.error);