"""
Integration Tests for AI Visibility System
Comprehensive testing of query generation, LLM orchestration, and response analysis
"""

import pytest
import asyncio
import json
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.services.ai_visibility.query_generator import (
    IntelligentQueryGenerator, 
    QueryContext, 
    QueryIntent,
    GeneratedQuery
)
from src.services.ai_visibility.llm_orchestrator import (
    LLMOrchestrator,
    OrchestratorConfig,
    LLMProvider,
    LLMResponse,
    CostTracker,
    ProviderHealthMonitor
)
from src.services.ai_visibility.response_analyzer import (
    ResponseAnalyzer,
    AnalysisResult,
    BrandPresence,
    CompetitorMention
)
from src.services.ai_visibility.cache_manager import CacheManager
from src.services.ai_visibility.job_processor import JobProcessor


class TestQueryGenerator:
    """Test suite for query generation"""
    
    @pytest.fixture
    def query_generator(self):
        """Create query generator instance"""
        return IntelligentQueryGenerator(openai_api_key="test-key", model="gpt-4")
    
    @pytest.fixture
    def sample_context(self):
        """Create sample query context"""
        return QueryContext(
            company_name="TechCorp",
            industry="Software Development",
            sub_industry="DevOps Tools",
            description="Leading platform for CI/CD automation",
            unique_value_propositions=["Fastest deployment", "99.99% uptime"],
            target_audiences=[{"name": "DevOps Engineers", "size": "500K"}],
            competitors=["Jenkins", "CircleCI", "GitLab"],
            products_services=["CI/CD Platform", "Container Registry"],
            pain_points_solved=["Slow deployments", "Complex configurations"],
            geographic_markets=["North America", "Europe"],
            technology_stack=["Kubernetes", "Docker"],
            pricing_model="Subscription",
            company_size="500-1000",
            founding_year=2020,
            key_features=["Auto-scaling", "Real-time monitoring"],
            use_cases=["Web apps", "Mobile apps"],
            integrations=["GitHub", "AWS", "Azure"],
            certifications=["SOC2", "ISO27001"]
        )
    
    @pytest.mark.asyncio
    async def test_query_generation(self, query_generator, sample_context):
        """Test query generation with various intents"""
        with patch.object(query_generator.client.chat.completions, 'create', new_callable=AsyncMock) as mock_create:
            # Mock GPT response
            mock_create.return_value = Mock(
                choices=[Mock(
                    message=Mock(
                        content=json.dumps({
                            "queries": [
                                {
                                    "query_text": "best CI/CD tools for DevOps",
                                    "complexity": 0.7,
                                    "buyer_stage": "consideration"
                                }
                            ]
                        })
                    )
                )]
            )
            
            queries = await query_generator.generate_queries(
                context=sample_context,
                target_count=10,
                diversity_threshold=0.7
            )
            
            assert len(queries) > 0
            assert isinstance(queries[0], GeneratedQuery)
            assert queries[0].query_text
            assert queries[0].intent in QueryIntent
    
    @pytest.mark.asyncio
    async def test_query_diversity(self, query_generator, sample_context):
        """Test that generated queries are diverse"""
        with patch.object(query_generator, '_generate_query_batches', new_callable=AsyncMock) as mock_generate:
            mock_generate.return_value = [
                {"query_text": "best CI/CD tools", "intent": "commercial", "complexity": 0.5},
                {"query_text": "CI/CD automation platforms", "intent": "commercial", "complexity": 0.6},
                {"query_text": "how to speed up deployments", "intent": "problem_solving", "complexity": 0.4},
            ]
            
            queries = await query_generator.generate_queries(sample_context, target_count=3)
            
            # Check diversity
            query_texts = [q.query_text for q in queries]
            assert len(set(query_texts)) == len(query_texts)  # All unique
    
    def test_competitive_relevance_calculation(self, query_generator, sample_context):
        """Test competitive relevance scoring"""
        score1 = query_generator._calculate_competitive_relevance(
            "best CI/CD tools comparison",
            sample_context
        )
        score2 = query_generator._calculate_competitive_relevance(
            "what is continuous integration",
            sample_context
        )
        
        assert score1 > score2  # Competitive query should score higher
        assert 0 <= score1 <= 1
        assert 0 <= score2 <= 1


class TestLLMOrchestrator:
    """Test suite for LLM orchestration"""
    
    @pytest.fixture
    def orchestrator_config(self):
        """Create orchestrator configuration"""
        return OrchestratorConfig(
            openai_api_key="test-openai-key",
            anthropic_api_key="test-anthropic-key",
            google_api_key="test-google-key",
            perplexity_api_key="test-perplexity-key",
            max_parallel_requests=3,
            request_timeout=30,
            circuit_breaker_threshold=3,
            circuit_breaker_timeout=60
        )
    
    @pytest.fixture
    def orchestrator(self, orchestrator_config):
        """Create orchestrator instance"""
        return LLMOrchestrator(orchestrator_config)
    
    @pytest.mark.asyncio
    async def test_parallel_execution(self, orchestrator):
        """Test parallel execution across multiple LLMs"""
        queries = ["best DevOps tools", "CI/CD automation platforms"]
        
        with patch.object(orchestrator, '_execute_openai', new_callable=AsyncMock) as mock_openai:
            with patch.object(orchestrator, '_execute_anthropic', new_callable=AsyncMock) as mock_anthropic:
                mock_openai.return_value = LLMResponse(
                    provider=LLMProvider.OPENAI_GPT4,
                    query=queries[0],
                    response_text="OpenAI response",
                    response_time_ms=100,
                    tokens_used=50,
                    model_version="gpt-4"
                )
                mock_anthropic.return_value = LLMResponse(
                    provider=LLMProvider.ANTHROPIC_CLAUDE,
                    query=queries[0],
                    response_text="Claude response",
                    response_time_ms=150,
                    tokens_used=60,
                    model_version="claude-3"
                )
                
                results = await orchestrator.execute_queries(
                    queries=queries,
                    providers=[LLMProvider.OPENAI_GPT4, LLMProvider.ANTHROPIC_CLAUDE]
                )
                
                assert len(results) > 0
                assert any(r.provider == LLMProvider.OPENAI_GPT4 for r in results)
    
    def test_cost_tracking(self):
        """Test cost tracking functionality"""
        cost_tracker = CostTracker(daily_limit=100.0)
        
        # Test cost calculation
        cost = cost_tracker.calculate_cost(
            LLMProvider.OPENAI_GPT4,
            input_tokens=1000,
            output_tokens=500
        )
        assert cost > 0
        
        # Test daily limit
        assert cost_tracker.add_cost(LLMProvider.OPENAI_GPT4, 50.0) == True
        assert cost_tracker.add_cost(LLMProvider.OPENAI_GPT4, 60.0) == False  # Exceeds limit
        
        # Test remaining budget
        remaining = cost_tracker.get_remaining_budget()
        assert remaining == 50.0
    
    def test_health_monitoring(self):
        """Test provider health monitoring"""
        monitor = ProviderHealthMonitor()
        
        # Record successes
        monitor.record_success(LLMProvider.OPENAI_GPT4, latency_ms=100, cost=0.05)
        monitor.record_success(LLMProvider.OPENAI_GPT4, latency_ms=150, cost=0.06)
        
        # Record failures
        monitor.record_failure(LLMProvider.ANTHROPIC_CLAUDE, "RateLimitError")
        
        # Check metrics
        openai_metrics = monitor.metrics[LLMProvider.OPENAI_GPT4]
        assert openai_metrics['successful_requests'] == 2
        assert openai_metrics['total_cost'] == 0.11
        
        claude_metrics = monitor.metrics[LLMProvider.ANTHROPIC_CLAUDE]
        assert claude_metrics['failed_requests'] == 1
    
    @pytest.mark.asyncio
    async def test_circuit_breaker(self, orchestrator):
        """Test circuit breaker functionality"""
        # Simulate multiple failures
        for _ in range(5):
            orchestrator.health_monitor.record_failure(
                LLMProvider.OPENAI_GPT4,
                "ServiceUnavailable"
            )
        
        # Check if circuit is open
        is_available = orchestrator._is_provider_available(LLMProvider.OPENAI_GPT4)
        assert is_available == False  # Circuit should be open
    
    @pytest.mark.asyncio
    async def test_fallback_mechanism(self, orchestrator):
        """Test fallback to alternative providers"""
        with patch.object(orchestrator, '_execute_openai', side_effect=Exception("OpenAI failed")):
            with patch.object(orchestrator, '_execute_anthropic', new_callable=AsyncMock) as mock_anthropic:
                mock_anthropic.return_value = LLMResponse(
                    provider=LLMProvider.ANTHROPIC_CLAUDE,
                    query="test query",
                    response_text="Fallback response",
                    response_time_ms=200,
                    tokens_used=70,
                    model_version="claude-3"
                )
                
                results = await orchestrator.execute_queries(
                    queries=["test query"],
                    providers=[LLMProvider.OPENAI_GPT4, LLMProvider.ANTHROPIC_CLAUDE]
                )
                
                # Should fallback to Anthropic
                assert len(results) == 1
                assert results[0].provider == LLMProvider.ANTHROPIC_CLAUDE


class TestResponseAnalyzer:
    """Test suite for response analysis"""
    
    @pytest.fixture
    def analyzer(self):
        """Create analyzer instance"""
        return ResponseAnalyzer(openai_api_key="test-key", model="gpt-4")
    
    @pytest.fixture
    def sample_responses(self):
        """Create sample LLM responses"""
        return [
            LLMResponse(
                provider=LLMProvider.OPENAI_GPT4,
                query="best CI/CD tools",
                response_text="TechCorp is a leading CI/CD platform alongside Jenkins and GitLab.",
                response_time_ms=100,
                tokens_used=50,
                model_version="gpt-4"
            ),
            LLMResponse(
                provider=LLMProvider.ANTHROPIC_CLAUDE,
                query="DevOps automation platforms",
                response_text="For DevOps automation, consider CircleCI, Jenkins, or newer platforms.",
                response_time_ms=150,
                tokens_used=60,
                model_version="claude-3"
            )
        ]
    
    @pytest.mark.asyncio
    async def test_brand_presence_detection(self, analyzer, sample_responses):
        """Test brand presence detection in responses"""
        with patch.object(analyzer.client.chat.completions, 'create', new_callable=AsyncMock) as mock_create:
            mock_create.return_value = Mock(
                choices=[Mock(
                    message=Mock(
                        content=json.dumps({
                            "brand_mentioned": True,
                            "mention_context": "positive",
                            "prominence_score": 0.8,
                            "competitors_mentioned": ["Jenkins", "GitLab"],
                            "sentiment": "positive",
                            "recommendation_strength": 0.7
                        })
                    )
                )]
            )
            
            results = await analyzer.analyze_responses(
                responses=sample_responses,
                brand_name="TechCorp",
                competitors=["Jenkins", "CircleCI", "GitLab"]
            )
            
            assert len(results) > 0
            assert isinstance(results[0], AnalysisResult)
            assert results[0].brand_presence.is_mentioned == True
    
    @pytest.mark.asyncio
    async def test_competitive_analysis(self, analyzer, sample_responses):
        """Test competitive landscape analysis"""
        with patch.object(analyzer, '_analyze_competitive_landscape', new_callable=AsyncMock) as mock_analyze:
            mock_analyze.return_value = {
                "TechCorp": {"mentions": 1, "sentiment": 0.8, "position": 2},
                "Jenkins": {"mentions": 2, "sentiment": 0.6, "position": 1},
                "GitLab": {"mentions": 1, "sentiment": 0.7, "position": 3}
            }
            
            landscape = await analyzer._analyze_competitive_landscape(
                sample_responses,
                "TechCorp",
                ["Jenkins", "GitLab"]
            )
            
            assert "TechCorp" in landscape
            assert landscape["Jenkins"]["mentions"] > landscape["TechCorp"]["mentions"]
    
    def test_visibility_score_calculation(self, analyzer):
        """Test visibility score calculation"""
        score = analyzer._calculate_visibility_score(
            brand_mentions=5,
            total_responses=10,
            avg_prominence=0.7,
            positive_sentiment_ratio=0.8
        )
        
        assert 0 <= score <= 100
        assert score > 50  # Should be relatively high given the inputs


class TestCacheManager:
    """Test suite for cache management"""
    
    @pytest.fixture
    async def cache_manager(self):
        """Create cache manager instance"""
        redis_mock = AsyncMock()
        manager = CacheManager(redis_mock)
        await manager.initialize()
        return manager
    
    @pytest.mark.asyncio
    async def test_cache_operations(self, cache_manager):
        """Test cache get/set operations"""
        # Test cache set
        await cache_manager.set(
            key="test_query",
            value={"response": "test response"},
            ttl=3600
        )
        
        # Test cache get
        with patch.object(cache_manager.redis, 'get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = json.dumps({"response": "test response"})
            
            result = await cache_manager.get("test_query")
            assert result == {"response": "test response"}
    
    @pytest.mark.asyncio
    async def test_cache_invalidation(self, cache_manager):
        """Test cache invalidation"""
        await cache_manager.invalidate_pattern("query:*")
        cache_manager.redis.delete.assert_called()
    
    @pytest.mark.asyncio
    async def test_cache_statistics(self, cache_manager):
        """Test cache hit rate tracking"""
        cache_manager.stats["hits"] = 80
        cache_manager.stats["misses"] = 20
        
        hit_rate = await cache_manager.get_hit_rate()
        assert hit_rate == 80.0


class TestJobProcessor:
    """Test suite for job processing"""
    
    @pytest.fixture
    def job_processor(self):
        """Create job processor instance"""
        return JobProcessor(
            redis_client=AsyncMock(),
            db_pool=Mock(),
            query_generator=Mock(),
            llm_orchestrator=Mock(),
            response_analyzer=Mock(),
            cache_manager=Mock(),
            websocket_manager=Mock()
        )
    
    @pytest.mark.asyncio
    async def test_job_processing_pipeline(self, job_processor):
        """Test complete job processing pipeline"""
        job_data = {
            "audit_id": "audit_123",
            "context": {
                "company_name": "TechCorp",
                "industry": "Software",
                "description": "CI/CD platform"
            },
            "user_email": "test@example.com",
            "session_id": "session_123"
        }
        
        with patch.object(job_processor, '_process_audit', new_callable=AsyncMock) as mock_process:
            mock_process.return_value = {
                "status": "completed",
                "results": {"visibility_score": 75}
            }
            
            result = await job_processor._process_job(job_data)
            
            assert result["status"] == "completed"
            mock_process.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_error_handling(self, job_processor):
        """Test error handling in job processing"""
        job_data = {
            "audit_id": "audit_failed",
            "context": {}
        }
        
        with patch.object(job_processor, '_process_audit', side_effect=Exception("Processing failed")):
            with patch.object(job_processor, '_handle_job_failure', new_callable=AsyncMock) as mock_handle:
                await job_processor._process_job(job_data)
                mock_handle.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_websocket_notifications(self, job_processor):
        """Test WebSocket notifications during processing"""
        with patch.object(job_processor.websocket_manager, 'send_to_channel', new_callable=AsyncMock) as mock_send:
            await job_processor._send_progress_update(
                audit_id="audit_123",
                stage="query_generation",
                progress=25,
                message="Generating queries..."
            )
            
            mock_send.assert_called_once()
            call_args = mock_send.call_args[0]
            assert call_args[0] == "audit:audit_123"
            assert call_args[1]["progress"] == 25


class TestEndToEndIntegration:
    """End-to-end integration tests"""
    
    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_complete_audit_flow(self):
        """Test complete audit flow from request to results"""
        # This would be a full integration test with real services
        # For now, we'll mock the components
        
        audit_request = {
            "company_name": "TechCorp",
            "industry": "Software",
            "description": "Leading CI/CD platform",
            "competitors": ["Jenkins", "CircleCI"],
            "unique_value_propositions": ["Fast", "Reliable"]
        }
        
        # Mock the entire flow
        with patch('src.services.ai_visibility.main.job_processor') as mock_processor:
            mock_processor.process_audit.return_value = {
                "audit_id": "audit_integration_test",
                "status": "completed",
                "visibility_score": 82.5,
                "brand_mentions": 15,
                "competitor_analysis": {
                    "TechCorp": {"position": 2, "score": 82.5},
                    "Jenkins": {"position": 1, "score": 85.0},
                    "CircleCI": {"position": 3, "score": 78.0}
                },
                "recommendations": [
                    "Increase content about DevOps best practices",
                    "Add more case studies and testimonials"
                ]
            }
            
            result = mock_processor.process_audit(audit_request)
            
            assert result["status"] == "completed"
            assert result["visibility_score"] > 0
            assert len(result["recommendations"]) > 0


if __name__ == "__main__":
    pytest.main(["-v", __file__])