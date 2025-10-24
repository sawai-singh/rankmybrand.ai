#!/usr/bin/env python3
"""
Automated script to apply remaining async/sync fixes to job_processor.py
Fixes the remaining 5 database operations
"""

import re

# Read the file
with open('src/core/services/job_processor.py', 'r') as f:
    content = f.read()

# Fix 1: _calculate_scores() - add sync version
calculate_scores_sync = '''
    def _store_scores_sync(self, audit_id: str, visibility_score: float, sentiment_score: float,
                           recommendation_score: float, geo_score: float, sov_score: float,
                           context_completeness: float, overall_score: float):
        """Store scores in database (synchronous version for thread pool)"""
        conn = self._get_db_connection_sync()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO audit_score_breakdown
                    (audit_id, visibility, sentiment, recommendation, geo, sov,
                     context_completeness, overall, formula_version)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'v2_enhanced')
                    ON CONFLICT (audit_id) DO UPDATE SET
                        visibility = EXCLUDED.visibility,
                        sentiment = EXCLUDED.sentiment,
                        recommendation = EXCLUDED.recommendation,
                        geo = EXCLUDED.geo,
                        sov = EXCLUDED.sov,
                        context_completeness = EXCLUDED.context_completeness,
                        overall = EXCLUDED.overall,
                        formula_version = EXCLUDED.formula_version
                """, (audit_id, visibility_score, sentiment_score, recommendation_score,
                      geo_score, sov_score, context_completeness, overall_score))

                cursor.execute("""
                    UPDATE ai_visibility_audits
                    SET
                        overall_score = %s,
                        brand_mention_rate = %s,
                        sentiment_score = %s,
                        recommendation_score = %s,
                        geo_score = %s,
                        sov_score = %s,
                        context_completeness_score = %s
                    WHERE id = %s
                """, (overall_score, visibility_score, sentiment_score, recommendation_score,
                      geo_score, sov_score, context_completeness, audit_id))

            conn.commit()
        finally:
            self._put_db_connection_sync(conn)
'''

# Insert before _calculate_scores
content = content.replace(
    '    async def _calculate_scores(',
    calculate_scores_sync + '\n    async def _calculate_scores('
)

# Replace the async with block in _calculate_scores
calc_scores_old = '''        # Store scores in database
        async with self.get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Store individual component scores
                cursor.execute("""
                    INSERT INTO audit_score_breakdown
                    (audit_id, visibility, sentiment, recommendation, geo, sov,
                     context_completeness, overall, formula_version)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'v2_enhanced')
                    ON CONFLICT (audit_id) DO UPDATE SET
                        visibility = EXCLUDED.visibility,
                        sentiment = EXCLUDED.sentiment,
                        recommendation = EXCLUDED.recommendation,
                        geo = EXCLUDED.geo,
                        sov = EXCLUDED.sov,
                        context_completeness = EXCLUDED.context_completeness,
                        overall = EXCLUDED.overall,
                        formula_version = EXCLUDED.formula_version
                """, (
                    audit_id,
                    visibility_score,
                    sentiment_score,
                    recommendation_score,
                    geo_score,
                    sov_score,
                    aggregate_metrics.get('context_completeness_score', 0),
                    overall_score
                ))

                # Update main audit record with scores
                cursor.execute("""
                    UPDATE ai_visibility_audits
                    SET
                        overall_score = %s,
                        brand_mention_rate = %s,
                        sentiment_score = %s,
                        recommendation_score = %s,
                        geo_score = %s,
                        sov_score = %s,
                        context_completeness_score = %s
                    WHERE id = %s
                """, (
                    overall_score,
                    visibility_score,
                    sentiment_score,
                    recommendation_score,
                    geo_score,
                    sov_score,
                    aggregate_metrics.get('context_completeness_score', 0),
                    audit_id
                ))

                conn.commit()'''

calc_scores_new = '''        # Store scores in database using thread pool
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            self._store_scores_sync,
            audit_id, visibility_score, sentiment_score, recommendation_score,
            geo_score, sov_score, aggregate_metrics.get('context_completeness_score', 0),
            overall_score
        )'''

content = content.replace(calc_scores_old, calc_scores_new)

# Fix 2: _generate_insights() - add sync version
insights_sync = '''
    def _store_insights_sync(self, audit_id: str, insights: List[str]):
        """Store insights in database (synchronous version for thread pool)"""
        conn = self._get_db_connection_sync()
        try:
            with conn.cursor() as cursor:
                for insight in insights:
                    cursor.execute("""
                        INSERT INTO audit_insights (audit_id, insight_text, category, importance)
                        VALUES (%s, %s, %s, %s)
                    """, (audit_id, insight, 'general', 'high'))
            conn.commit()
        finally:
            self._put_db_connection_sync(conn)
'''

# Insert before _generate_insights
content = content.replace(
    '    async def _generate_insights(',
    insights_sync + '\n    async def _generate_insights('
)

# Replace the async with block in _generate_insights
insights_old = '''        # Store insights
        async with self.get_db_connection() as conn:
            with conn.cursor() as cursor:
                for insight in insights:
                    cursor.execute("""
                        INSERT INTO audit_insights (audit_id, insight_text, category, importance)
                        VALUES (%s, %s, %s, %s)
                    """, (audit_id, insight, 'general', 'high'))

            conn.commit()'''

insights_new = '''        # Store insights using thread pool
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._store_insights_sync, audit_id, insights)'''

content = content.replace(insights_old, insights_new)

# Fix 3: _update_audit_status() - add sync version and replace
update_status_sync = '''
    def _update_audit_status_sync(self, audit_id: str, status: str, error_message: Optional[str] = None):
        """Update audit status in database (synchronous version for thread pool)"""
        conn = self._get_db_connection_sync()
        try:
            with conn.cursor() as cursor:
                if status == 'processing':
                    cursor.execute(
                        "UPDATE ai_visibility_audits SET status = %s, started_at = NOW() WHERE id = %s",
                        (status, audit_id)
                    )
                elif status == 'completed':
                    cursor.execute(
                        "UPDATE ai_visibility_audits SET status = %s, completed_at = NOW() WHERE id = %s",
                        (status, audit_id)
                    )
                elif status == 'failed':
                    cursor.execute(
                        "UPDATE ai_visibility_audits SET status = %s, error_message = %s WHERE id = %s",
                        (status, error_message, audit_id)
                    )
                else:
                    cursor.execute(
                        "UPDATE ai_visibility_audits SET status = %s WHERE id = %s",
                        (status, audit_id)
                    )
            conn.commit()
        finally:
            self._put_db_connection_sync(conn)

    async def _update_audit_status(
        self,
        audit_id: str,
        status: str,
        error_message: Optional[str] = None
    ):
        """Async wrapper that runs sync database operations in thread pool"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._update_audit_status_sync, audit_id, status, error_message)
'''

# Replace entire _update_audit_status function
update_status_old_pattern = r'    async def _update_audit_status\(\s*self,\s*audit_id: str,\s*status: str,\s*error_message: Optional\[str\] = None\s*\):\s*"""Update audit status in database"""\s*async with self\.get_db_connection\(\) as conn:.*?conn\.commit\(\)'

content = re.sub(update_status_old_pattern, update_status_sync.strip(), content, flags=re.DOTALL)

print("Applied all async/sync fixes successfully!")
print("Modified file: src/core/services/job_processor.py")

# Write back
with open('src/core/services/job_processor.py', 'w') as f:
    f.write(content)
