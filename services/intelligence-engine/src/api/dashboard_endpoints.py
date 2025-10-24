"""
Dashboard API Endpoints
Serves all data from the dashboard_data table to the frontend
Single source of truth for dashboard display
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Dict, List, Any, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
import json
from datetime import datetime
import logging

from src.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


def get_db_connection():
    """Create database connection"""
    return psycopg2.connect(
        host=settings.postgres_host,
        port=settings.postgres_port,
        database=settings.postgres_db,
        user=settings.postgres_user,
        password=settings.postgres_password
    )


@router.get("/summary/{company_id}")
async def get_dashboard_summary(
    company_id: int,
    user_id: Optional[int] = Query(None, description="Optional user filter")
) -> Dict[str, Any]:
    """
    Get dashboard summary for a company
    Returns the latest audit data with all scores and recommendations
    """
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Build query with optional user filter
        base_query = """
            SELECT 
                audit_id,
                company_name,
                industry,
                company_size,
                -- Overall metrics
                overall_score,
                geo_score,
                sov_score,
                visibility_score,
                sentiment_score,
                -- Brand analysis
                brand_mention_rate,
                brand_sentiment,
                brand_sentiment_distribution,
                -- Top recommendations (limited for summary)
                top_recommendations,
                quick_wins,
                executive_summary,
                -- Competitive position
                main_competitors,
                market_share_estimate,
                -- Provider performance
                best_performing_provider,
                worst_performing_provider,
                -- Audit metadata
                audit_status,
                audit_completed_at,
                created_at,
                -- Calculated fields
                CASE 
                    WHEN overall_score < 40 THEN 'High'
                    WHEN overall_score < 70 THEN 'Medium'
                    ELSE 'Low'
                END as improvement_potential,
                CASE
                    WHEN sov_score > 60 THEN 'Market Leader'
                    WHEN sov_score > 40 THEN 'Competitive'
                    WHEN sov_score > 20 THEN 'Challenger'
                    ELSE 'Needs Improvement'
                END as competitive_position
            FROM dashboard_data
            WHERE company_id = %s
              AND audit_status = 'completed'
        """
        
        params = [company_id]
        if user_id:
            base_query += " AND user_id = %s"
            params.append(user_id)
        
        base_query += " ORDER BY created_at DESC LIMIT 1"
        
        cursor.execute(base_query, params)
        result = cursor.fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="No dashboard data found for this company")
        
        # Convert to dict and parse JSON fields
        dashboard_data = dict(result)
        
        # Parse JSON fields
        json_fields = [
            'brand_sentiment_distribution', 'top_recommendations', 'quick_wins',
            'main_competitors', 'market_share_estimate'
        ]
        for field in json_fields:
            if dashboard_data.get(field) and isinstance(dashboard_data[field], str):
                try:
                    dashboard_data[field] = json.loads(dashboard_data[field])
                except:
                    pass
        
        # Limit recommendations for summary (top 5)
        if dashboard_data.get('top_recommendations'):
            dashboard_data['top_recommendations'] = dashboard_data['top_recommendations'][:5]
        
        return {
            "status": "success",
            "data": dashboard_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching dashboard summary: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        cursor.close()
        conn.close()


@router.get("/detailed/{audit_id}")
async def get_detailed_dashboard(audit_id: str) -> Dict[str, Any]:
    """
    Get complete detailed dashboard data for a specific audit
    Returns ALL data including provider analysis, query details, etc.
    """
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cursor.execute("""
            SELECT * FROM dashboard_data WHERE audit_id = %s
        """, (audit_id,))
        
        result = cursor.fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="Dashboard data not found for this audit")
        
        # Convert to dict
        dashboard_data = dict(result)
        
        # Parse all JSON fields
        json_fields = [
            'score_breakdown', 'score_trends', 'brand_sentiment_distribution',
            'main_competitors', 'competitor_mentions', 'competitor_comparison',
            'competitive_gaps', 'competitive_advantages', 'market_share_estimate',
            'provider_scores', 'provider_response_times', 'provider_token_usage',
            'provider_sentiment_analysis', 'provider_recommendation_analysis',
            'queries_list', 'query_categories', 'query_performance',
            'top_performing_queries', 'worst_performing_queries',
            'top_recommendations', 'strategic_themes', 'quick_wins',
            'long_term_initiatives', 'implementation_roadmap', 'estimated_roi',
            'persona_context', 'response_details', 'content_gaps',
            'content_opportunities', 'keyword_performance', 'seo_recommendations',
            'key_insights', 'market_trends', 'opportunity_areas', 'risk_areas',
            'error_messages', 'audit_config',
            # 118-call architecture strategic intelligence
            'category_insights', 'strategic_priorities', 'executive_summary_v2',
            'buyer_journey_insights', 'intelligence_metadata'
        ]
        
        for field in json_fields:
            if dashboard_data.get(field) and isinstance(dashboard_data[field], str):
                try:
                    dashboard_data[field] = json.loads(dashboard_data[field])
                except:
                    pass
        
        # Convert timestamps to ISO format
        timestamp_fields = ['created_at', 'updated_at', 'audit_started_at', 'audit_completed_at']
        for field in timestamp_fields:
            if dashboard_data.get(field) and isinstance(dashboard_data[field], datetime):
                dashboard_data[field] = dashboard_data[field].isoformat()
        
        return {
            "status": "success",
            "data": dashboard_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching detailed dashboard: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        cursor.close()
        conn.close()


@router.get("/recommendations/{audit_id}")
async def get_recommendations(
    audit_id: str,
    category: Optional[str] = Query(None, description="Filter by category"),
    limit: int = Query(20, description="Number of recommendations to return")
) -> Dict[str, Any]:
    """
    Get recommendations from dashboard data
    Can filter by category and limit results
    """
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cursor.execute("""
            SELECT 
                top_recommendations,
                quick_wins,
                long_term_initiatives,
                strategic_themes,
                implementation_roadmap,
                estimated_roi,
                executive_summary,
                personalized_narrative
            FROM dashboard_data 
            WHERE audit_id = %s
        """, (audit_id,))
        
        result = cursor.fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="No recommendations found for this audit")
        
        # Parse JSON fields
        data = dict(result)
        for field in ['top_recommendations', 'quick_wins', 'long_term_initiatives', 
                      'strategic_themes', 'implementation_roadmap', 'estimated_roi']:
            if data.get(field) and isinstance(data[field], str):
                try:
                    data[field] = json.loads(data[field])
                except:
                    data[field] = []
        
        # Filter by category if specified
        if category and data.get('top_recommendations'):
            filtered = [
                rec for rec in data['top_recommendations']
                if rec.get('category', '').lower() == category.lower()
            ]
            data['top_recommendations'] = filtered
        
        # Apply limit
        if data.get('top_recommendations'):
            data['top_recommendations'] = data['top_recommendations'][:limit]
        
        return {
            "status": "success",
            "data": data,
            "total": len(data.get('top_recommendations', [])),
            "limit": limit
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching recommendations: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        cursor.close()
        conn.close()


@router.get("/competitive-analysis/{audit_id}")
async def get_competitive_analysis(audit_id: str) -> Dict[str, Any]:
    """
    Get competitive analysis data
    Returns competitor mentions, market share, gaps, and advantages
    """
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cursor.execute("""
            SELECT 
                main_competitors,
                competitor_mentions,
                competitor_comparison,
                competitive_gaps,
                competitive_advantages,
                market_share_estimate,
                sov_score,
                brand_mention_rate
            FROM dashboard_data 
            WHERE audit_id = %s
        """, (audit_id,))
        
        result = cursor.fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="No competitive analysis found")
        
        data = dict(result)
        
        # Parse JSON fields
        json_fields = ['main_competitors', 'competitor_mentions', 'competitor_comparison',
                       'competitive_gaps', 'competitive_advantages', 'market_share_estimate']
        for field in json_fields:
            if data.get(field) and isinstance(data[field], str):
                try:
                    data[field] = json.loads(data[field])
                except:
                    data[field] = {}
        
        # Add competitive position assessment
        sov = data.get('sov_score', 0)
        if sov > 60:
            data['market_position'] = 'Leader'
            data['position_description'] = 'Dominating AI visibility in your market'
        elif sov > 40:
            data['market_position'] = 'Competitive'
            data['position_description'] = 'Strong presence but opportunities to grow'
        elif sov > 20:
            data['market_position'] = 'Challenger'
            data['position_description'] = 'Building presence, significant growth potential'
        else:
            data['market_position'] = 'Emerging'
            data['position_description'] = 'Early stage, major opportunity to establish position'
        
        return {
            "status": "success",
            "data": data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching competitive analysis: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        cursor.close()
        conn.close()


@router.get("/provider-analysis/{audit_id}")
async def get_provider_analysis(audit_id: str) -> Dict[str, Any]:
    """
    Get LLM provider performance analysis
    Returns scores, response times, and recommendations by provider
    """
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cursor.execute("""
            SELECT 
                provider_scores,
                provider_response_times,
                provider_token_usage,
                provider_sentiment_analysis,
                provider_recommendation_analysis,
                best_performing_provider,
                worst_performing_provider
            FROM dashboard_data 
            WHERE audit_id = %s
        """, (audit_id,))
        
        result = cursor.fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="No provider analysis found")
        
        data = dict(result)
        
        # Parse JSON fields
        json_fields = ['provider_scores', 'provider_response_times', 'provider_token_usage',
                       'provider_sentiment_analysis', 'provider_recommendation_analysis']
        for field in json_fields:
            if data.get(field) and isinstance(data[field], str):
                try:
                    data[field] = json.loads(data[field])
                except:
                    data[field] = {}
        
        return {
            "status": "success",
            "data": data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching provider analysis: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        cursor.close()
        conn.close()


@router.get("/history/{company_id}")
async def get_audit_history(
    company_id: int,
    limit: int = Query(10, description="Number of audits to return")
) -> Dict[str, Any]:
    """
    Get historical audit data for trend analysis
    Returns list of past audits with key metrics
    """
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cursor.execute("""
            SELECT 
                audit_id,
                overall_score,
                geo_score,
                sov_score,
                brand_mention_rate,
                audit_completed_at,
                created_at
            FROM dashboard_data 
            WHERE company_id = %s
              AND audit_status = 'completed'
            ORDER BY created_at DESC
            LIMIT %s
        """, (company_id, limit))
        
        results = cursor.fetchall()
        
        if not results:
            return {
                "status": "success",
                "data": [],
                "message": "No audit history found"
            }
        
        # Convert to list of dicts with timestamp formatting
        history = []
        for row in results:
            audit = dict(row)
            if audit.get('created_at'):
                audit['created_at'] = audit['created_at'].isoformat()
            if audit.get('audit_completed_at'):
                audit['audit_completed_at'] = audit['audit_completed_at'].isoformat()
            history.append(audit)
        
        # Calculate trends if we have multiple audits
        if len(history) > 1:
            latest = history[0]
            previous = history[1]
            
            trends = {
                'overall_score_change': latest['overall_score'] - previous['overall_score'],
                'geo_score_change': latest['geo_score'] - previous['geo_score'],
                'sov_score_change': latest['sov_score'] - previous['sov_score'],
                'brand_mention_change': latest['brand_mention_rate'] - previous['brand_mention_rate']
            }
        else:
            trends = None
        
        return {
            "status": "success",
            "data": history,
            "trends": trends,
            "total": len(history)
        }
        
    except Exception as e:
        logger.error(f"Error fetching audit history: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        cursor.close()
        conn.close()


@router.get("/insights/{audit_id}")
async def get_insights(audit_id: str) -> Dict[str, Any]:
    """
    Get strategic insights and opportunities
    Returns key insights, opportunities, risks, and trends
    """
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cursor.execute("""
            SELECT 
                key_insights,
                opportunity_areas,
                risk_areas,
                market_trends,
                content_gaps,
                content_opportunities,
                seo_recommendations
            FROM dashboard_data 
            WHERE audit_id = %s
        """, (audit_id,))
        
        result = cursor.fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="No insights found")
        
        data = dict(result)
        
        # Parse JSON fields
        for field in data.keys():
            if data.get(field) and isinstance(data[field], str):
                try:
                    data[field] = json.loads(data[field])
                except:
                    data[field] = []
        
        return {
            "status": "success",
            "data": data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching insights: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        cursor.close()
        conn.close()


# Include router in main app
def include_router(app):
    """Include dashboard router in FastAPI app"""
    app.include_router(router)