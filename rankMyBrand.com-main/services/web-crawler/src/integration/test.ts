import { GEOAnalysisService } from "./geo-analysis-service";

const geoService = new GEOAnalysisService();

// Analyze a website
const result = await geoService.analyzeWebsite({
  url: 'https://semrush.com',
  keywords: ['AI', 'optimization'],
  pages: 100
});

// Generate executive report
const report = await geoService.generateExecutiveReport(result.jobId);
console.log(report);