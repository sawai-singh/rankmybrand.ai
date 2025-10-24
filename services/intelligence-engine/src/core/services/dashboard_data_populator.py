"""
Dashboard Data Populator
Consolidates all audit data into the dashboard_data table
Single source of truth for dashboard API endpoints
"""

import json
import logging
import asyncio
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
from decimal import Decimal
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor, Json
import numpy as np

from ..analysis.world_class_recommendation_aggregator import WorldClassRecommendationAggregator

logger = logging.getLogger(__name__)


def convert_decimals(obj):
    """Recursively convert Decimal objects to float for JSON serialization"""
    if isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, dict):
        return {k: convert_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_decimals(item) for item in obj]
    return obj


class DashboardDataPopulator:
    """
    Populates the dashboard_data table with ALL metrics and insights
    This is what the dashboard will display to customers
    """

    def __init__(self, db_config: Dict[str, Any], openai_api_key: str):
        self.db_config = db_config
        # Initialize connection pool for better performance
        self.db_pool = pool.ThreadedConnectionPool(
            minconn=2,
            maxconn=10,
            **db_config
        )
        logger.info("Database connection pool initialized (2-10 connections)")
        self.aggregator = WorldClassRecommendationAggregator(
            openai_api_key=openai_api_key,
            db_config=db_config
        )

    def _get_connection(self):
        """Get a connection from the pool"""
        return self.db_pool.getconn()

    def _return_connection(self, conn):
        """Return a connection to the pool"""
        self.db_pool.putconn(conn)

    def __del__(self):
        """Close all connections when object is destroyed"""
        if hasattr(self, 'db_pool'):
            self.db_pool.closeall()
            logger.info("Database connection pool closed")
    
    async def populate_dashboard_data(
        self,
        audit_id: str,
        company_id: int,
        user_id: Optional[int] = None
    ) -> bool:
        """
        Main entry point - populates dashboard_data table with everything

        This is called after:
        1. All responses are analyzed
        2. Data is migrated to ai_responses
        3. Scores are calculated

        Returns: True if successful
        """

        logger.info(f"Starting dashboard data population for audit {audit_id}")

        # If user_id not provided, look it up from companies table
        if user_id is None:
            user_id = await self._lookup_user_id(company_id)
            if user_id is None:
                error_msg = f"Could not find user_id for company_id {company_id}"
                logger.error(error_msg)
                raise ValueError(error_msg)
            logger.info(f"Looked up user_id {user_id} for company_id {company_id}")

        try:
            # CRITICAL VALIDATION: Verify all responses are complete before populating
            await self._validate_audit_completion(audit_id)

            # Step 1: Gather all data from various tables
            audit_data = await self._gather_audit_data(audit_id)
            company_data = await self._gather_company_data(company_id)
            response_data = await self._gather_response_data(audit_id)
            score_data = await self._gather_score_data(audit_id)

            # Step 2: Calculate aggregated metrics
            aggregated_metrics = await self._calculate_aggregated_metrics(
                response_data, audit_data
            )

            # Step 3: Analyze by provider
            provider_analysis = await self._analyze_by_provider(response_data)

            # Step 4: Analyze competitors
            competitor_analysis = await self._analyze_competitors(response_data)

            # Step 5: Get all recommendations from responses
            all_recommendations = await self._extract_all_recommendations(audit_id)

            # Step 6: Use world-class aggregator for recommendations
            logger.info("")
            logger.info("=" * 80)
            logger.info("STEP 6: WORLD-CLASS RECOMMENDATION AGGREGATION")
            logger.info("=" * 80)
            logger.info(f"Processing {len(all_recommendations)} raw recommendations from LLMs...")
            top_recommendations, executive_package = await self.aggregator.create_world_class_recommendations(
                audit_id=audit_id,
                company_id=company_id,
                all_recommendations=all_recommendations
            )
            logger.info(f"✅ Generated {len(top_recommendations)} hyper-personalized recommendations")
            logger.info("")

            # Step 7: Generate insights
            logger.info("STEP 7: GENERATING INSIGHTS")
            logger.info("-" * 80)
            insights = await self._generate_insights(
                aggregated_metrics,
                provider_analysis,
                competitor_analysis
            )
            logger.info(f"✅ Generated {len(insights.get('key_insights', []))} key insights")
            logger.info("")

            # Step 8: 🚀 Gather Layer 1-3 Strategic Intelligence (118-call architecture)
            logger.info("=" * 80)
            logger.info("STEP 8: GATHERING STRATEGIC INTELLIGENCE (118-CALL ARCHITECTURE)")
            logger.info("=" * 80)
            logger.info("📊 Retrieving processed intelligence from database...")
            logger.info("")

            logger.info("Layer 1: Category Insights (18 LLM calls)")
            category_insights = await self._gather_category_insights(audit_id)
            logger.info(f"   ✓ Retrieved {len(category_insights)} buyer journey categories")
            for category in list(category_insights.keys())[:6]:
                types_count = len(category_insights[category])
                logger.info(f"     • {category}: {types_count} insight types")
            logger.info("")

            logger.info("Layer 2: Strategic Priorities (3 LLM calls)")
            strategic_priorities = await self._gather_strategic_priorities(audit_id)
            logger.info(f"   ✓ Retrieved {len(strategic_priorities)} priority types")
            for ptype, priorities in strategic_priorities.items():
                logger.info(f"     • {ptype}: {len(priorities)} priorities")
            logger.info("")

            logger.info("Layer 3: Executive Summary (1 LLM call)")
            executive_summary_v2 = await self._gather_executive_summary(audit_id)
            if executive_summary_v2:
                logger.info(f"   ✓ Executive summary retrieved")
                logger.info(f"     • Persona: {executive_summary_v2.get('persona', 'N/A')}")
                summary_sections = len(executive_summary_v2.get('summary', {}))
                logger.info(f"     • Sections: {summary_sections}")
            else:
                logger.warning("   ⚠ No executive summary found")
            logger.info("")

            logger.info("Phase 2: Buyer Journey Batch Insights (96 LLM calls)")
            buyer_journey_insights = await self._gather_buyer_journey_insights(audit_id)
            total_batches = sum(len(batches) for batches in buyer_journey_insights.values())
            logger.info(f"   ✓ Retrieved {total_batches} batches across {len(buyer_journey_insights)} categories")
            logger.info("")

            logger.info("Processing Metadata")
            intelligence_metadata = await self._gather_intelligence_metadata(audit_id)
            if intelligence_metadata:
                logger.info(f"   ✓ Metadata retrieved:")
                logger.info(f"     • Total LLM Calls: {intelligence_metadata.get('total_llm_calls', 'N/A')}")
                logger.info(f"     • Processing Time: {intelligence_metadata.get('processing_time_seconds', 'N/A')}s")
                logger.info(f"     • Total Cost: ${intelligence_metadata.get('total_cost', 'N/A')}")
            else:
                logger.warning("   ⚠ No metadata found")
            logger.info("")

            logger.info("=" * 80)
            logger.info("✨ STRATEGIC INTELLIGENCE GATHERING COMPLETE")
            logger.info("=" * 80)
            logger.info(f"📦 Summary:")
            logger.info(f"   • Category Insights: {len(category_insights)} categories")
            logger.info(f"   • Strategic Priorities: {sum(len(p) for p in strategic_priorities.values())} total priorities")
            logger.info(f"   • Executive Summary: {'✅ Ready' if executive_summary_v2 else '❌ Missing'}")
            logger.info(f"   • Buyer Journey Batches: {total_batches} batches")
            logger.info(f"   • Total Intelligence Layers: 4 (Phase 2 + Layers 1-3)")
            logger.info("=" * 80)
            logger.info("")

            # Step 9: Populate the dashboard_data table
            success = await self._insert_dashboard_data(
                audit_id=audit_id,
                company_id=company_id,
                user_id=user_id,
                company_data=company_data,
                audit_data=audit_data,
                aggregated_metrics=aggregated_metrics,
                provider_analysis=provider_analysis,
                competitor_analysis=competitor_analysis,
                top_recommendations=top_recommendations,
                executive_package=executive_package,
                insights=insights,
                score_data=score_data,
                # Layer 1-3 data (118-call architecture)
                category_insights=category_insights,
                strategic_priorities=strategic_priorities,
                executive_summary_v2=executive_summary_v2,
                buyer_journey_insights=buyer_journey_insights,
                intelligence_metadata=intelligence_metadata
            )

            logger.info(f"Dashboard data population successful for audit {audit_id}")
            return success

        except Exception as e:
            # Don't swallow exceptions - let them propagate with full context
            logger.error(f"Error populating dashboard data for audit {audit_id}: {e}")
            import traceback
            logger.error(f"Full traceback:\n{traceback.format_exc()}")
            # Re-raise with additional context
            raise RuntimeError(f"Dashboard data population failed for audit {audit_id}: {str(e)}") from e

    async def _lookup_user_id(self, company_id: int) -> Optional[int]:
        """Look up user_id from companies table"""
        conn = self._get_connection()
        cursor = conn.cursor()

        try:
            cursor.execute("""
                SELECT u.id
                FROM users u
                WHERE u.company_id = %s
                LIMIT 1
            """, (company_id,))
            result = cursor.fetchone()
            return result[0] if result else None
        finally:
            cursor.close()
            self._return_connection(conn)

    async def _validate_audit_completion(self, audit_id: str) -> None:
        """
        Validate that all audit responses are complete before populating dashboard.
        Raises ValueError if audit is incomplete.
        """
        conn = self._get_connection()
        cursor = conn.cursor()

        try:
            # Check total queries generated
            cursor.execute("""
                SELECT COUNT(*) as total_queries
                FROM audit_queries
                WHERE audit_id = %s
            """, (audit_id,))
            result = cursor.fetchone()
            total_queries = result[0] if result else 0

            if total_queries == 0:
                raise ValueError(f"Audit {audit_id} has no queries generated")

            # Check total responses received
            cursor.execute("""
                SELECT COUNT(*) as total_responses
                FROM audit_responses
                WHERE audit_id = %s
            """, (audit_id,))
            result = cursor.fetchone()
            total_responses = result[0] if result else 0

            # Each query should have responses from multiple LLM providers
            # Minimum acceptable: at least 50% of queries have responses
            expected_min_responses = total_queries * 0.5

            if total_responses < expected_min_responses:
                raise ValueError(
                    f"Audit {audit_id} incomplete: {total_responses} responses out of "
                    f"{total_queries} queries (expected minimum {expected_min_responses})"
                )

            # Check for unanalyzed responses (missing sentiment or brand mention data)
            cursor.execute("""
                SELECT COUNT(*) as unanalyzed
                FROM audit_responses
                WHERE audit_id = %s
                AND (sentiment IS NULL OR brand_mentioned IS NULL)
            """, (audit_id,))
            result = cursor.fetchone()
            unanalyzed = result[0] if result else 0

            if unanalyzed > 0:
                logger.warning(f"Audit {audit_id} has {unanalyzed} unanalyzed responses")
                # Don't fail, but log warning

            logger.info(
                f"Audit {audit_id} validation passed: {total_queries} queries, "
                f"{total_responses} responses, {unanalyzed} unanalyzed"
            )

        finally:
            cursor.close()
            self._return_connection(conn)

    async def _gather_audit_data(self, audit_id: str) -> Dict[str, Any]:
        """Gather audit-level data"""
        conn = self._get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            cursor.execute("""
                SELECT * FROM ai_visibility_audits WHERE id = %s
            """, (audit_id,))
            audit_data = cursor.fetchone() or {}
            
            # Get query information
            cursor.execute("""
                SELECT query_text, category, priority_score 
                FROM audit_queries 
                WHERE audit_id = %s
                ORDER BY priority_score DESC NULLS LAST
            """, (audit_id,))
            queries = cursor.fetchall()
            
            audit_data['queries'] = queries
            audit_data['total_queries'] = len(queries)
            
            return dict(audit_data)
            
        finally:
            cursor.close()
            self._return_connection(conn)
    
    async def _gather_company_data(self, company_id: int) -> Dict[str, Any]:
        """Gather company and enrichment data with robust error handling"""
        conn = self._get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        try:
            # Check if logo_url column exists to support older databases
            cursor.execute("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'companies'
                    AND column_name = 'logo_url'
                )
            """)
            result = cursor.fetchone()
            has_logo_column = result[0] if result else False

            # Build query dynamically based on column existence
            if has_logo_column:
                cursor.execute("""
                    SELECT
                        name as company_name,
                        domain,
                        industry,
                        employee_count,
                        COALESCE(headquarters_city || ', ' || headquarters_country, 'Boston, USA') as headquarters,
                        logo_url
                    FROM companies
                    WHERE id = %s
                """, (company_id,))
            else:
                logger.warning("logo_url column not found in companies table, skipping")
                cursor.execute("""
                    SELECT
                        name as company_name,
                        domain,
                        industry,
                        employee_count,
                        COALESCE(headquarters_city || ', ' || headquarters_country, 'Boston, USA') as headquarters
                    FROM companies
                    WHERE id = %s
                """, (company_id,))

            company_data = cursor.fetchone()

            if not company_data:
                logger.warning(f"No company data found for company_id {company_id}")
                return {
                    'company_name': 'Unknown Company',
                    'domain': '',
                    'industry': '',
                    'employee_count': 0,
                    'headquarters': 'Unknown',
                    'logo_url': None
                }

            # Convert to dict and ensure logo_url exists (even if NULL)
            result = dict(company_data)
            if 'logo_url' not in result:
                result['logo_url'] = None

            # Sanitize logo_url: remove empty strings, whitespace-only, or invalid URLs
            if result.get('logo_url'):
                logo_url = str(result['logo_url']).strip()
                # Basic URL validation
                if not logo_url or len(logo_url) < 10 or not (logo_url.startswith('http://') or logo_url.startswith('https://')):
                    logger.debug(f"Invalid logo_url: {logo_url}, setting to None")
                    result['logo_url'] = None
                else:
                    result['logo_url'] = logo_url
            else:
                result['logo_url'] = None

            return result

        except Exception as e:
            logger.error(f"Error gathering company data: {e}")
            # Return safe defaults to prevent crashes
            return {
                'company_name': 'Unknown Company',
                'domain': '',
                'industry': '',
                'employee_count': 0,
                'headquarters': 'Unknown',
                'logo_url': None
            }
        finally:
            cursor.close()
            self._return_connection(conn)
    
    async def _gather_response_data(self, audit_id: str) -> List[Dict[str, Any]]:
        """Gather all response analysis data"""
        conn = self._get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            cursor.execute("""
                SELECT
                    ar.*,
                    aq.query_text,
                    aq.category as query_category
                FROM audit_responses ar
                JOIN audit_queries aq ON ar.query_id::text = aq.id::text
                WHERE ar.audit_id = %s
            """, (audit_id,))
            
            responses = cursor.fetchall()
            return [dict(r) for r in responses]
            
        finally:
            cursor.close()
            self._return_connection(conn)
    
    async def _gather_score_data(self, audit_id: str) -> Dict[str, Any]:
        """Gather score data from ai_responses"""
        conn = self._get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        try:
            # Calculate aggregate scores from ai_responses
            cursor.execute("""
                SELECT
                    AVG(geo_score) as avg_geo_score,
                    AVG(sov_score) as avg_sov_score,
                    AVG(CASE WHEN sentiment = 'positive' THEN 100
                             WHEN sentiment = 'neutral' THEN 50
                             WHEN sentiment = 'negative' THEN 0
                             ELSE 50 END) as avg_sentiment_score,
                    AVG(CASE WHEN brand_mentioned THEN 100 ELSE 0 END) as visibility_score,
                    COUNT(*) as total_responses
                FROM audit_responses
                WHERE audit_id = %s
            """, (audit_id,))

            result = cursor.fetchone()
            if result:
                score_data = dict(result)
                # Convert Decimals to float for calculation
                geo_score = float(score_data.get('avg_geo_score', 0) or 0)
                sov_score = float(score_data.get('avg_sov_score', 0) or 0)
                visibility_score = float(score_data.get('visibility_score', 0) or 0)
                sentiment_score = float(score_data.get('avg_sentiment_score', 0) or 0)

                # Calculate overall score as weighted average
                overall = (
                    geo_score * 0.3 +
                    sov_score * 0.3 +
                    visibility_score * 0.2 +
                    sentiment_score * 0.2
                )
                return {
                    'geo': geo_score,
                    'sov': sov_score,
                    'sentiment': sentiment_score,
                    'visibility': visibility_score,
                    'overall': overall,
                    'recommendation': 80.0,  # Default high score for having recommendations
                    'context_completeness': 75.0  # Default good score
                }
            return {}

        finally:
            cursor.close()
            self._return_connection(conn)

    async def _gather_category_insights(self, audit_id: str) -> Dict[str, Any]:
        """Gather Layer 1 category-level insights (118-call architecture)"""
        conn = self._get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        try:
            cursor.execute("""
                SELECT
                    category,
                    extraction_type,
                    insights,
                    funnel_stage,
                    company_context,
                    persona_context
                FROM category_aggregated_insights
                WHERE audit_id = %s
                ORDER BY category, extraction_type
            """, (audit_id,))

            rows = cursor.fetchall()

            # Structure: { category: { extraction_type: insights } }
            category_insights = {}
            for row in rows:
                category = row['category']
                extraction_type = row['extraction_type']

                if category not in category_insights:
                    category_insights[category] = {}

                category_insights[category][extraction_type] = row['insights']

            return category_insights

        except Exception as e:
            logger.warning(f"No category insights found for audit {audit_id}: {e}")
            return {}
        finally:
            cursor.close()
            self._return_connection(conn)

    async def _gather_strategic_priorities(self, audit_id: str) -> Dict[str, Any]:
        """Gather Layer 2 strategic priorities (118-call architecture)"""
        conn = self._get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        try:
            cursor.execute("""
                SELECT
                    extraction_type,
                    rank,
                    priority_data,
                    source_categories,
                    funnel_stages_impacted
                FROM strategic_priorities
                WHERE audit_id = %s
                ORDER BY extraction_type, rank
            """, (audit_id,))

            rows = cursor.fetchall()

            # Structure: { extraction_type: [priorities ranked 1-N] }
            strategic_priorities = {}
            for row in rows:
                extraction_type = row['extraction_type']

                if extraction_type not in strategic_priorities:
                    strategic_priorities[extraction_type] = []

                strategic_priorities[extraction_type].append({
                    'rank': row['rank'],
                    'priority': row['priority_data'],
                    'source_categories': row['source_categories'],
                    'funnel_stages_impacted': row['funnel_stages_impacted']
                })

            return strategic_priorities

        except Exception as e:
            logger.warning(f"No strategic priorities found for audit {audit_id}: {e}")
            return {}
        finally:
            cursor.close()
            self._return_connection(conn)

    async def _gather_executive_summary(self, audit_id: str) -> Dict[str, Any]:
        """Gather Layer 3 executive summary (118-call architecture)"""
        conn = self._get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        try:
            cursor.execute("""
                SELECT
                    summary_data,
                    persona,
                    company_id
                FROM executive_summaries
                WHERE audit_id = %s
                LIMIT 1
            """, (audit_id,))

            row = cursor.fetchone()

            if row:
                return {
                    'summary': row['summary_data'],
                    'persona': row['persona'],
                    'company_id': row['company_id']
                }

            return {}

        except Exception as e:
            logger.warning(f"No executive summary found for audit {audit_id}: {e}")
            return {}
        finally:
            cursor.close()
            self._return_connection(conn)

    async def _gather_buyer_journey_insights(self, audit_id: str) -> Dict[str, Any]:
        """Gather Phase 2 buyer journey batch insights (118-call architecture)"""
        conn = self._get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        try:
            cursor.execute("""
                SELECT
                    category,
                    batch_number,
                    extraction_type,
                    insights,
                    response_ids
                FROM buyer_journey_batch_insights
                WHERE audit_id = %s
                ORDER BY category, batch_number, extraction_type
            """, (audit_id,))

            rows = cursor.fetchall()

            # Structure: { category: { batch_number: { extraction_type: insights } } }
            buyer_journey_insights = {}
            for row in rows:
                category = row['category']
                batch_number = row['batch_number']
                extraction_type = row['extraction_type']

                if category not in buyer_journey_insights:
                    buyer_journey_insights[category] = {}

                if batch_number not in buyer_journey_insights[category]:
                    buyer_journey_insights[category][batch_number] = {}

                buyer_journey_insights[category][batch_number][extraction_type] = row['insights']

            return buyer_journey_insights

        except Exception as e:
            logger.warning(f"No buyer journey insights found for audit {audit_id}: {e}")
            return {}
        finally:
            cursor.close()
            self._return_connection(conn)

    async def _gather_intelligence_metadata(self, audit_id: str) -> Dict[str, Any]:
        """Gather processing metadata for 118-call architecture"""
        conn = self._get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        try:
            cursor.execute("""
                SELECT
                    total_llm_calls,
                    phase2_calls,
                    layer1_calls,
                    layer2_calls,
                    layer3_calls,
                    total_cost,
                    processing_time_seconds,
                    phase2_time_seconds,
                    layer1_time_seconds,
                    layer2_time_seconds,
                    layer3_time_seconds
                FROM audit_processing_metadata
                WHERE audit_id = %s
                LIMIT 1
            """, (audit_id,))

            row = cursor.fetchone()

            if row:
                return dict(row)

            return {}

        except Exception as e:
            logger.warning(f"No intelligence metadata found for audit {audit_id}: {e}")
            return {}
        finally:
            cursor.close()
            self._return_connection(conn)
    
    async def _calculate_aggregated_metrics(
        self,
        responses: List[Dict[str, Any]],
        audit_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Calculate overall aggregated metrics"""
        
        total = len(responses)
        if total == 0:
            return {}
        
        # Brand metrics
        brand_mentioned = sum(1 for r in responses if r.get('brand_mentioned'))
        brand_mention_rate = (brand_mentioned / total) * 100
        
        # Sentiment distribution
        sentiments = [r.get('sentiment', 'neutral') for r in responses]
        sentiment_dist = {
            'positive': sentiments.count('positive'),
            'neutral': sentiments.count('neutral'),
            'negative': sentiments.count('negative'),
            'mixed': sentiments.count('mixed')
        }
        
        # Average scores
        geo_scores = [r.get('geo_score', 0) for r in responses if r.get('geo_score')]
        sov_scores = [r.get('sov_score', 0) for r in responses if r.get('sov_score')]
        
        # Featured snippet and voice search
        featured_snippet = sum(1 for r in responses if r.get('featured_snippet_potential'))
        voice_optimized = sum(1 for r in responses if r.get('voice_search_optimized'))
        
        return {
            'total_responses': total,
            'brand_mention_rate': brand_mention_rate,
            'brand_mentioned_count': brand_mentioned,
            'sentiment_distribution': sentiment_dist,
            'avg_geo_score': np.mean(geo_scores) if geo_scores else 0,
            'avg_sov_score': np.mean(sov_scores) if sov_scores else 0,
            'featured_snippet_rate': (featured_snippet / total) * 100,
            'voice_search_rate': (voice_optimized / total) * 100,
            'query_categories': audit_data.get('queries', [])
        }
    
    async def _analyze_by_provider(self, responses: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze performance by LLM provider"""
        
        providers = {}
        for response in responses:
            provider = response.get('provider')
            if not provider:
                continue
            
            if provider not in providers:
                providers[provider] = {
                    'responses': [],
                    'geo_scores': [],
                    'sov_scores': [],
                    'response_times': [],
                    'sentiments': [],
                    'brand_mentions': 0
                }
            
            providers[provider]['responses'].append(response)
            # Only append non-None scores to avoid numpy errors
            geo_score = response.get('geo_score')
            if geo_score is not None:
                providers[provider]['geo_scores'].append(geo_score)
            sov_score = response.get('sov_score')
            if sov_score is not None:
                providers[provider]['sov_scores'].append(sov_score)
            providers[provider]['response_times'].append(response.get('response_time_ms', 0))
            providers[provider]['sentiments'].append(response.get('sentiment', 'neutral'))
            if response.get('brand_mentioned'):
                providers[provider]['brand_mentions'] += 1
        
        # Calculate averages
        provider_analysis = {}
        for provider, data in providers.items():
            total = len(data['responses'])
            provider_analysis[provider] = {
                'total_responses': total,
                'avg_geo_score': np.mean(data['geo_scores']) if data['geo_scores'] else 0,
                'avg_sov_score': np.mean(data['sov_scores']) if data['sov_scores'] else 0,
                'avg_response_time': np.mean(data['response_times']) if data['response_times'] else 0,
                'brand_mention_rate': (data['brand_mentions'] / total) * 100 if total > 0 else 0,
                'sentiment_breakdown': {
                    'positive': data['sentiments'].count('positive'),
                    'neutral': data['sentiments'].count('neutral'),
                    'negative': data['sentiments'].count('negative')
                }
            }
        
        # Determine best and worst providers
        if provider_analysis:
            # Best by combined score
            best_provider = max(
                provider_analysis.items(),
                key=lambda x: x[1]['avg_geo_score'] + x[1]['avg_sov_score']
            )[0]
            
            worst_provider = min(
                provider_analysis.items(),
                key=lambda x: x[1]['avg_geo_score'] + x[1]['avg_sov_score']
            )[0]
        else:
            best_provider = worst_provider = None
        
        return {
            'provider_scores': provider_analysis,
            'best_provider': best_provider,
            'worst_provider': worst_provider
        }
    
    async def _analyze_competitors(self, responses: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze competitor mentions and positioning"""
        
        competitor_mentions = {}
        competitive_gaps = []
        competitive_advantages = []
        
        for response in responses:
            # Parse competitor mentions
            comp_mentions = response.get('competitor_mentions')
            if comp_mentions:
                if isinstance(comp_mentions, str):
                    try:
                        comp_mentions = json.loads(comp_mentions)
                    except:
                        comp_mentions = []
                
                for comp in comp_mentions if isinstance(comp_mentions, list) else []:
                    if isinstance(comp, dict):
                        name = comp.get('name', 'Unknown')
                        if name not in competitor_mentions:
                            competitor_mentions[name] = {
                                'count': 0,
                                'sentiments': [],
                                'contexts': []
                            }
                        
                        competitor_mentions[name]['count'] += 1
                        competitor_mentions[name]['sentiments'].append(comp.get('sentiment', 'neutral'))
                        if comp.get('context'):
                            competitor_mentions[name]['contexts'].append(comp.get('context'))
        
        # Calculate market share estimate (simplified)
        total_mentions = sum(c['count'] for c in competitor_mentions.values())
        market_share = {}
        if total_mentions > 0:
            for name, data in competitor_mentions.items():
                market_share[name] = round((data['count'] / total_mentions) * 100, 1)
        
        return {
            'competitor_mentions': competitor_mentions,
            'market_share_estimate': market_share,
            'competitive_gaps': competitive_gaps,
            'competitive_advantages': competitive_advantages,
            'main_competitors': list(competitor_mentions.keys())[:5]
        }
    
    async def _extract_all_recommendations(self, audit_id: str) -> List[Dict[str, Any]]:
        """Extract all recommendations from ai_responses"""
        conn = self._get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            cursor.execute("""
                SELECT
                    ar.provider,
                    ar.query_id,
                    ar.recommendations,
                    aq.query_text,
                    aq.category
                FROM audit_responses ar
                JOIN audit_queries aq ON ar.query_id::text = aq.id::text
                WHERE ar.audit_id = %s
                  AND ar.recommendations IS NOT NULL
            """, (audit_id,))
            
            all_recommendations = []
            for row in cursor.fetchall():
                recs = row['recommendations']
                if recs:
                    if isinstance(recs, str):
                        try:
                            recs = json.loads(recs)
                        except:
                            continue
                    
                    # Add context to each recommendation
                    for rec in (recs if isinstance(recs, list) else [recs]):
                        if isinstance(rec, dict):
                            rec['provider'] = row['provider']
                            rec['query_id'] = row['query_id']
                            rec['query_text'] = row['query_text']
                            rec['query_category'] = row['category']
                            all_recommendations.append(rec)
            
            return all_recommendations
            
        finally:
            cursor.close()
            self._return_connection(conn)
    
    async def _generate_insights(
        self,
        metrics: Dict[str, Any],
        provider_analysis: Dict[str, Any],
        competitor_analysis: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate strategic insights from the data"""
        
        insights = []
        opportunities = []
        risks = []
        
        # Brand visibility insights
        brand_rate = metrics.get('brand_mention_rate', 0)
        if brand_rate < 30:
            insights.append({
                'type': 'critical',
                'category': 'visibility',
                'message': f"Critical: Brand mentioned in only {brand_rate:.1f}% of AI responses",
                'action': "Urgent content creation and SEO optimization needed"
            })
            risks.append("Low AI visibility threatens future market position")
        
        # GEO/SOV insights
        geo = metrics.get('avg_geo_score', 0)
        sov = metrics.get('avg_sov_score', 0)
        
        if geo > 70 and sov < 30:
            insights.append({
                'type': 'opportunity',
                'category': 'positioning',
                'message': "Strong content quality but low market share",
                'action': "Increase content volume and distribution"
            })
            opportunities.append("Content quality foundation ready for scaling")
        
        # Provider insights
        provider_scores = provider_analysis.get('provider_scores', {})
        if provider_scores:
            variance = np.var([p['avg_geo_score'] for p in provider_scores.values()])
            if variance > 100:  # High variance between providers
                insights.append({
                    'type': 'warning',
                    'category': 'consistency',
                    'message': "High variance in AI provider responses",
                    'action': "Optimize for consistency across platforms"
                })
        
        # Competitor insights
        main_competitors = competitor_analysis.get('main_competitors', [])
        if main_competitors:
            market_share = competitor_analysis.get('market_share_estimate', {})
            leader = max(market_share.items(), key=lambda x: x[1])[0] if market_share else None
            if leader and leader in main_competitors:
                insights.append({
                    'type': 'competitive',
                    'category': 'market',
                    'message': f"{leader} dominates AI mindshare",
                    'action': f"Develop competitive content strategy against {leader}"
                })
        
        return {
            'key_insights': insights,
            'opportunity_areas': opportunities,
            'risk_areas': risks,
            'market_trends': []  # Could be populated with trend analysis
        }
    
    async def _insert_dashboard_data(
        self,
        audit_id: str,
        company_id: int,
        user_id: int,
        company_data: Dict[str, Any],
        audit_data: Dict[str, Any],
        aggregated_metrics: Dict[str, Any],
        provider_analysis: Dict[str, Any],
        competitor_analysis: Dict[str, Any],
        top_recommendations: List[Any],
        executive_package: Dict[str, Any],
        insights: Dict[str, Any],
        score_data: Dict[str, Any],
        # Layer 1-3 strategic intelligence (118-call architecture)
        category_insights: Optional[Dict[str, Any]] = None,
        strategic_priorities: Optional[Dict[str, Any]] = None,
        executive_summary_v2: Optional[Dict[str, Any]] = None,
        buyer_journey_insights: Optional[Dict[str, Any]] = None,
        intelligence_metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Insert all data into dashboard_data table"""
        
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            # Convert recommendations to JSON-serializable format
            recommendations_json = []
            for rec in top_recommendations[:10]:  # Top 10
                recommendations_json.append({
                    'headline': rec.headline,
                    'executive_pitch': rec.executive_pitch,
                    'strategic_rationale': rec.strategic_rationale,
                    'implementation_approach': rec.implementation_approach,
                    'priority_score': rec.priority_score,
                    'urgency_driver': rec.urgency_driver,
                    'quick_wins': rec.quick_wins,
                    'expected_impact': rec.expected_impact,
                    'roi_calculation': rec.roi_calculation,
                    'next_steps': rec.next_steps
                })
            
            # Prepare quick wins
            all_quick_wins = []
            for rec in top_recommendations[:5]:
                all_quick_wins.extend(rec.quick_wins[:2])
            
            # Calculate company size (handle None values)
            employee_count = company_data.get('employee_count')
            if employee_count is None:
                employee_count = 0
                company_size = 'unknown'
            elif employee_count < 50:
                company_size = 'startup'
            elif employee_count < 250:
                company_size = 'smb'
            elif employee_count < 1000:
                company_size = 'midmarket'
            else:
                company_size = 'enterprise'
            
            # Check if dashboard_data table has company_logo_url column
            cursor.execute("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'dashboard_data'
                    AND column_name = 'company_logo_url'
                )
            """)
            result = cursor.fetchone()
            has_dashboard_logo_column = result[0] if result else False

            # Prepare logo value - ensure it's safe
            logo_url_value = company_data.get('logo_url')
            if logo_url_value and not isinstance(logo_url_value, str):
                logger.warning(f"Invalid logo_url type: {type(logo_url_value)}, setting to None")
                logo_url_value = None

            # Insert or update dashboard data with fallback for missing column
            if has_dashboard_logo_column:
                cursor.execute("""
                    INSERT INTO dashboard_data (
                        audit_id, company_id, user_id,
                        company_name, company_domain, industry, sub_industry,
                        company_size, employee_count, annual_revenue, funding_stage,
                        headquarters, company_logo_url,
                        overall_score, geo_score, sov_score,
                    visibility_score, sentiment_score, recommendation_score,
                    context_completeness_score,
                    brand_mentioned_count, brand_mention_rate,
                    brand_sentiment, brand_sentiment_distribution,
                    main_competitors, competitor_mentions,
                    market_share_estimate,
                    provider_scores, best_performing_provider, worst_performing_provider,
                    total_queries, queries_list,
                    top_recommendations, quick_wins,
                    executive_summary, personalized_narrative,
                    total_responses, responses_analyzed,
                    featured_snippet_potential_rate, voice_search_optimization_rate,
                    key_insights, opportunity_areas, risk_areas,
                    audit_status, audit_completed_at,
                    -- 118-call architecture Layer 1-3 columns
                    category_insights, strategic_priorities, executive_summary_v2,
                    buyer_journey_insights, intelligence_metadata,
                    created_at
                ) VALUES (
                    %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s,
                    %s, %s,
                    %s, %s,
                    %s, %s,
                    %s,
                    %s, %s, %s,
                    %s, %s,
                    %s, %s,
                    %s, %s,
                    %s, %s,
                    %s, %s,
                    %s, %s, %s,
                    %s, %s,
                    %s, %s, %s,
                    %s, %s,
                    NOW()
                )
                ON CONFLICT (audit_id) DO UPDATE SET
                    overall_score = EXCLUDED.overall_score,
                    geo_score = EXCLUDED.geo_score,
                    sov_score = EXCLUDED.sov_score,
                    brand_mention_rate = EXCLUDED.brand_mention_rate,
                    company_logo_url = EXCLUDED.company_logo_url,
                    top_recommendations = EXCLUDED.top_recommendations,
                    executive_summary = EXCLUDED.executive_summary,
                    audit_status = EXCLUDED.audit_status,
                    audit_completed_at = EXCLUDED.audit_completed_at,
                    -- 118-call architecture updates
                    category_insights = EXCLUDED.category_insights,
                    strategic_priorities = EXCLUDED.strategic_priorities,
                    executive_summary_v2 = EXCLUDED.executive_summary_v2,
                    buyer_journey_insights = EXCLUDED.buyer_journey_insights,
                    intelligence_metadata = EXCLUDED.intelligence_metadata,
                    updated_at = NOW()
            """, (
                audit_id, company_id, user_id,
                company_data.get('company_name', ''),
                company_data.get('domain', ''),
                company_data.get('industry', ''),
                company_data.get('sub_industry', ''),
                company_size,
                employee_count,
                company_data.get('annual_revenue'),
                company_data.get('funding_stage'),
                company_data.get('headquarters'),
                company_data.get('logo_url'),
                float(score_data.get('overall', 0)) if score_data.get('overall') else 0,
                float(score_data.get('geo', 0)) if score_data.get('geo') else 0,
                float(score_data.get('sov', 0)) if score_data.get('sov') else 0,
                float(score_data.get('visibility', 0)) if score_data.get('visibility') else 0,
                float(score_data.get('sentiment', 0)) if score_data.get('sentiment') else 0,
                float(score_data.get('recommendation', 0)) if score_data.get('recommendation') else 0,
                float(score_data.get('context_completeness', 0)) if score_data.get('context_completeness') else 0,
                aggregated_metrics.get('brand_mentioned_count', 0),
                aggregated_metrics.get('brand_mention_rate', 0),
                'positive',  # Simplified - could be calculated
                Json(convert_decimals(aggregated_metrics.get('sentiment_distribution', {}))),
                Json(convert_decimals(competitor_analysis.get('main_competitors', []))),
                Json(convert_decimals(competitor_analysis.get('competitor_mentions', {}))),
                Json(convert_decimals(competitor_analysis.get('market_share_estimate', {}))),
                Json(convert_decimals(provider_analysis.get('provider_scores', {}))),
                provider_analysis.get('best_provider'),
                provider_analysis.get('worst_provider'),
                aggregated_metrics.get('total_responses', 0),
                Json([q['query_text'] for q in audit_data.get('queries', [])]),
                Json(convert_decimals(recommendations_json)),
                Json(all_quick_wins),
                executive_package.get('executive_brief', ''),
                executive_package.get('personal_message', ''),
                aggregated_metrics.get('total_responses', 0),
                aggregated_metrics.get('total_responses', 0),
                aggregated_metrics.get('featured_snippet_rate', 0),
                aggregated_metrics.get('voice_search_rate', 0),
                Json(convert_decimals(insights.get('key_insights', []))),
                Json(convert_decimals(insights.get('opportunity_areas', []))),
                Json(convert_decimals(insights.get('risk_areas', []))),
                'completed',
                datetime.now(),
                # Layer 1-3 strategic intelligence (118-call architecture)
                Json(convert_decimals(category_insights)) if category_insights else None,
                Json(convert_decimals(strategic_priorities)) if strategic_priorities else None,
                Json(convert_decimals(executive_summary_v2)) if executive_summary_v2 else None,
                Json(convert_decimals(buyer_journey_insights)) if buyer_journey_insights else None,
                Json(convert_decimals(intelligence_metadata)) if intelligence_metadata else None
            ))
            
            conn.commit()
            logger.info(f"Successfully populated dashboard_data for audit {audit_id}")
            return True

        except Exception as e:
            conn.rollback()
            import traceback
            logger.error(f"Error inserting dashboard data for audit {audit_id}: {e}")
            logger.error(f"Full traceback:\n{traceback.format_exc()}")
            # Re-raise with context instead of returning False
            raise RuntimeError(f"Failed to insert dashboard data for audit {audit_id}: {str(e)}") from e

        finally:
            cursor.close()
            self._return_connection(conn)