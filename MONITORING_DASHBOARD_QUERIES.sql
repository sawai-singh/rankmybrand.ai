-- ═══════════════════════════════════════════════════════════════════════════════
-- Monitoring Dashboard SQL Queries
-- For detecting and preventing zero score systematic failures
-- ═══════════════════════════════════════════════════════════════════════════════

-- DASHBOARD 1: Audit Health Overview
-- ═══════════════════════════════════════════════════════════════════════════════

-- Query 1.1: Audit Status Distribution (Last 7 Days)
SELECT
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM ai_visibility_audits
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY status
ORDER BY count DESC;

-- Query 1.2: Zero Score Audits (CRITICAL ALERT)
SELECT
    id as audit_id,
    company_name,
    status,
    overall_score,
    brand_mention_rate,
    error_message,
    created_at,
    completed_at,
    EXTRACT(EPOCH FROM (completed_at - created_at))/60 as duration_minutes
FROM ai_visibility_audits
WHERE status = 'completed'
  AND overall_score = 0
  AND created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;

-- Query 1.3: Low Brand Detection Rate (WARNING ALERT)
SELECT
    id as audit_id,
    company_name,
    brand_mention_rate,
    overall_score,
    query_count,
    status,
    created_at
FROM ai_visibility_audits
WHERE status = 'completed'
  AND brand_mention_rate < 5.0
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY brand_mention_rate ASC, created_at DESC;

-- Query 1.4: Audit Completion Rate (Success Metric)
SELECT
    DATE(created_at) as date,
    COUNT(*) as total_audits,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
    ROUND(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as completion_rate
FROM ai_visibility_audits
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Query 1.5: Average Audit Duration by Status
SELECT
    status,
    COUNT(*) as count,
    ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - created_at))/60), 2) as avg_duration_minutes,
    ROUND(MIN(EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - created_at))/60), 2) as min_duration,
    ROUND(MAX(EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - created_at))/60), 2) as max_duration
FROM ai_visibility_audits
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY status
ORDER BY count DESC;


-- DASHBOARD 2: Brand Detection Health
-- ═══════════════════════════════════════════════════════════════════════════════

-- Query 2.1: Brand Detection Distribution
SELECT
    CASE
        WHEN brand_mention_rate >= 75 THEN '75-100% (Excellent)'
        WHEN brand_mention_rate >= 50 THEN '50-75% (Good)'
        WHEN brand_mention_rate >= 25 THEN '25-50% (Fair)'
        WHEN brand_mention_rate >= 5 THEN '5-25% (Poor)'
        ELSE '0-5% (Critical)'
    END as detection_range,
    COUNT(*) as audit_count,
    ROUND(AVG(overall_score), 2) as avg_overall_score
FROM ai_visibility_audits
WHERE status = 'completed'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY
    CASE
        WHEN brand_mention_rate >= 75 THEN '75-100% (Excellent)'
        WHEN brand_mention_rate >= 50 THEN '50-75% (Good)'
        WHEN brand_mention_rate >= 25 THEN '25-50% (Fair)'
        WHEN brand_mention_rate >= 5 THEN '5-25% (Poor)'
        ELSE '0-5% (Critical)'
    END
ORDER BY MIN(brand_mention_rate) DESC;

-- Query 2.2: Companies with Parenthetical Brand Names (At Risk)
SELECT
    c.id as company_id,
    c.name as company_name,
    COUNT(a.id) as total_audits,
    ROUND(AVG(a.brand_mention_rate), 2) as avg_brand_detection,
    ROUND(AVG(a.overall_score), 2) as avg_overall_score,
    MAX(a.created_at) as last_audit_date
FROM companies c
LEFT JOIN ai_visibility_audits a ON c.id = a.company_id AND a.status = 'completed'
WHERE c.name LIKE '%(%'  -- Has parentheses (potential risk)
GROUP BY c.id, c.name
ORDER BY avg_brand_detection ASC NULLS LAST;

-- Query 2.3: Top Companies by Brand Mention Rate (Success Stories)
SELECT
    a.company_name,
    COUNT(a.id) as audit_count,
    ROUND(AVG(a.brand_mention_rate), 2) as avg_detection_rate,
    ROUND(AVG(a.overall_score), 2) as avg_overall_score,
    MAX(a.completed_at) as last_completed
FROM ai_visibility_audits a
WHERE a.status = 'completed'
  AND a.created_at > NOW() - INTERVAL '90 days'
GROUP BY a.company_name
HAVING COUNT(a.id) >= 2
ORDER BY avg_detection_rate DESC
LIMIT 20;

-- Query 2.4: Brand Detection Trends (Time Series)
SELECT
    DATE(created_at) as date,
    COUNT(*) as audits_completed,
    ROUND(AVG(brand_mention_rate), 2) as avg_detection_rate,
    ROUND(AVG(overall_score), 2) as avg_overall_score,
    SUM(CASE WHEN brand_mention_rate < 5 THEN 1 ELSE 0 END) as critical_low_detection
FROM ai_visibility_audits
WHERE status = 'completed'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;


-- DASHBOARD 3: Data Quality Monitoring
-- ═══════════════════════════════════════════════════════════════════════════════

-- Query 3.1: Audits with Suspicious Patterns
SELECT
    a.id as audit_id,
    a.company_name,
    a.overall_score,
    a.brand_mention_rate,
    a.query_count,
    (SELECT COUNT(*) FROM audit_responses ar WHERE ar.audit_id = a.id) as responses_collected,
    (SELECT COUNT(*) FROM audit_responses ar WHERE ar.audit_id = a.id AND ar.geo_score IS NOT NULL) as responses_analyzed,
    (SELECT COUNT(*) FROM dashboard_data dd WHERE dd.audit_id = a.id) as dashboard_populated,
    a.error_message,
    a.completed_at
FROM ai_visibility_audits a
WHERE a.status = 'completed'
  AND a.created_at > NOW() - INTERVAL '7 days'
  AND (
    -- Suspicious pattern 1: Zero scores with responses
    (a.overall_score = 0 AND EXISTS (SELECT 1 FROM audit_responses ar WHERE ar.audit_id = a.id))
    OR
    -- Suspicious pattern 2: Completed but has error message
    (a.error_message IS NOT NULL AND a.error_message != '')
    OR
    -- Suspicious pattern 3: Very fast completion (< 2 minutes)
    (EXTRACT(EPOCH FROM (a.completed_at - a.started_at)) < 120)
    OR
    -- Suspicious pattern 4: No responses despite queries
    (a.query_count > 0 AND NOT EXISTS (SELECT 1 FROM audit_responses ar WHERE ar.audit_id = a.id))
  )
ORDER BY a.completed_at DESC;

-- Query 3.2: "Unknown Company" Dashboard Entries (Silent Failures)
SELECT
    dd.audit_id,
    dd.company_id,
    dd.company_name,
    dd.overall_score,
    dd.created_at,
    a.company_name as actual_company_name_from_audit,
    c.name as actual_company_name_from_table
FROM dashboard_data dd
LEFT JOIN ai_visibility_audits a ON dd.audit_id = a.id
LEFT JOIN companies c ON dd.company_id = c.id
WHERE dd.company_name = 'Unknown Company'
  AND dd.created_at > NOW() - INTERVAL '30 days'
ORDER BY dd.created_at DESC;

-- Query 3.3: Missing Score Breakdown Entries
SELECT
    a.id as audit_id,
    a.company_name,
    a.status,
    a.overall_score,
    a.completed_at,
    CASE WHEN asb.audit_id IS NULL THEN 'MISSING' ELSE 'EXISTS' END as score_breakdown_status
FROM ai_visibility_audits a
LEFT JOIN audit_score_breakdown asb ON a.id = asb.audit_id
WHERE a.status = 'completed'
  AND a.created_at > NOW() - INTERVAL '7 days'
  AND asb.audit_id IS NULL  -- Missing score breakdown
ORDER BY a.completed_at DESC;

-- Query 3.4: Response Analysis Completeness
SELECT
    a.id as audit_id,
    a.company_name,
    a.query_count as queries_generated,
    COUNT(ar.id) as responses_collected,
    SUM(CASE WHEN ar.geo_score IS NOT NULL THEN 1 ELSE 0 END) as responses_analyzed,
    ROUND(
        SUM(CASE WHEN ar.geo_score IS NOT NULL THEN 1 ELSE 0 END) * 100.0 /
        NULLIF(COUNT(ar.id), 0),
        2
    ) as analysis_completion_rate
FROM ai_visibility_audits a
LEFT JOIN audit_responses ar ON a.id = ar.audit_id
WHERE a.status = 'completed'
  AND a.created_at > NOW() - INTERVAL '7 days'
GROUP BY a.id, a.company_name, a.query_count
HAVING COUNT(ar.id) > 0
  AND SUM(CASE WHEN ar.geo_score IS NOT NULL THEN 1 ELSE 0 END) * 100.0 / COUNT(ar.id) < 50
ORDER BY analysis_completion_rate ASC;


-- DASHBOARD 4: Error Monitoring
-- ═══════════════════════════════════════════════════════════════════════════════

-- Query 4.1: Recent Error Messages
SELECT
    error_message,
    COUNT(*) as occurrence_count,
    STRING_AGG(DISTINCT company_name, ', ') as affected_companies,
    MAX(created_at) as last_occurrence
FROM ai_visibility_audits
WHERE error_message IS NOT NULL
  AND error_message != ''
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY error_message
ORDER BY occurrence_count DESC, last_occurrence DESC;

-- Query 4.2: Failed Audits Analysis
SELECT
    a.id as audit_id,
    a.company_name,
    a.error_message,
    a.current_phase,
    a.created_at,
    a.started_at,
    EXTRACT(EPOCH FROM (COALESCE(a.completed_at, NOW()) - a.started_at))/60 as duration_minutes,
    (SELECT COUNT(*) FROM audit_queries aq WHERE aq.audit_id = a.id) as queries_generated,
    (SELECT COUNT(*) FROM audit_responses ar WHERE ar.audit_id = a.id) as responses_collected
FROM ai_visibility_audits a
WHERE a.status = 'failed'
  AND a.created_at > NOW() - INTERVAL '7 days'
ORDER BY a.created_at DESC;

-- Query 4.3: Audits Stuck in Processing (Potential Hangs)
SELECT
    id as audit_id,
    company_name,
    status,
    current_phase,
    started_at,
    last_heartbeat,
    EXTRACT(EPOCH FROM (NOW() - last_heartbeat))/60 as minutes_since_heartbeat,
    EXTRACT(EPOCH FROM (NOW() - started_at))/60 as total_runtime_minutes
FROM ai_visibility_audits
WHERE status = 'processing'
  AND started_at < NOW() - INTERVAL '30 minutes'  -- Running for > 30 mins
ORDER BY started_at ASC;

-- Query 4.4: Error Rate Trend
SELECT
    DATE(created_at) as date,
    COUNT(*) as total_audits,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
    SUM(CASE WHEN error_message IS NOT NULL AND error_message != '' THEN 1 ELSE 0 END) as with_errors,
    ROUND(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as failure_rate
FROM ai_visibility_audits
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;


-- DASHBOARD 5: Performance Metrics
-- ═══════════════════════════════════════════════════════════════════════════════

-- Query 5.1: Audit Performance by Query Count
SELECT
    CASE
        WHEN query_count <= 20 THEN '1-20 queries'
        WHEN query_count <= 50 THEN '21-50 queries'
        WHEN query_count <= 100 THEN '51-100 queries'
        ELSE '100+ queries'
    END as query_range,
    COUNT(*) as audit_count,
    ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - started_at))/60), 2) as avg_duration_minutes,
    ROUND(AVG(overall_score), 2) as avg_overall_score,
    ROUND(AVG(brand_mention_rate), 2) as avg_detection_rate
FROM ai_visibility_audits
WHERE status = 'completed'
  AND created_at > NOW() - INTERVAL '30 days'
  AND started_at IS NOT NULL
  AND completed_at IS NOT NULL
GROUP BY
    CASE
        WHEN query_count <= 20 THEN '1-20 queries'
        WHEN query_count <= 50 THEN '21-50 queries'
        WHEN query_count <= 100 THEN '51-100 queries'
        ELSE '100+ queries'
    END
ORDER BY MIN(query_count);

-- Query 5.2: Response Analysis Performance
SELECT
    provider,
    COUNT(*) as total_responses,
    COUNT(CASE WHEN geo_score IS NOT NULL THEN 1 END) as analyzed_responses,
    ROUND(AVG(CASE WHEN geo_score IS NOT NULL THEN geo_score END), 2) as avg_geo_score,
    ROUND(AVG(CASE WHEN sov_score IS NOT NULL THEN sov_score END), 2) as avg_sov_score,
    ROUND(AVG(CASE WHEN brand_mentioned THEN 100.0 ELSE 0.0 END), 2) as brand_mention_rate
FROM audit_responses
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY provider
ORDER BY total_responses DESC;

-- Query 5.3: Top Slowest Audits (Performance Investigation)
SELECT
    a.id as audit_id,
    a.company_name,
    a.query_count,
    EXTRACT(EPOCH FROM (a.completed_at - a.started_at))/60 as duration_minutes,
    (SELECT COUNT(*) FROM audit_responses ar WHERE ar.audit_id = a.id) as responses_collected,
    a.completed_at
FROM ai_visibility_audits a
WHERE a.status = 'completed'
  AND a.started_at IS NOT NULL
  AND a.completed_at IS NOT NULL
  AND a.created_at > NOW() - INTERVAL '7 days'
ORDER BY duration_minutes DESC
LIMIT 20;


-- DASHBOARD 6: Alerting Queries (For Automated Monitoring)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Alert 1: Critical - Zero Score Audit Detected
SELECT
    'CRITICAL' as severity,
    'Zero Score Audit' as alert_type,
    id as audit_id,
    company_name,
    completed_at,
    'Audit completed with zero scores - requires immediate investigation' as message
FROM ai_visibility_audits
WHERE status = 'completed'
  AND overall_score = 0
  AND completed_at > NOW() - INTERVAL '1 hour'
ORDER BY completed_at DESC;

-- Alert 2: High - Low Brand Detection
SELECT
    'HIGH' as severity,
    'Low Brand Detection' as alert_type,
    id as audit_id,
    company_name,
    brand_mention_rate,
    'Brand detected in < 5% of responses - possible brand detection failure' as message
FROM ai_visibility_audits
WHERE status = 'completed'
  AND brand_mention_rate < 5.0
  AND completed_at > NOW() - INTERVAL '1 hour'
ORDER BY brand_mention_rate ASC;

-- Alert 3: Medium - Audit Stuck in Processing
SELECT
    'MEDIUM' as severity,
    'Audit Stuck' as alert_type,
    id as audit_id,
    company_name,
    EXTRACT(EPOCH FROM (NOW() - last_heartbeat))/60 as minutes_stuck,
    'Audit has been processing for extended time without progress' as message
FROM ai_visibility_audits
WHERE status = 'processing'
  AND last_heartbeat < NOW() - INTERVAL '30 minutes'
ORDER BY last_heartbeat ASC;

-- Alert 4: High - Multiple Failures in Short Time
SELECT
    'HIGH' as severity,
    'Failure Spike' as alert_type,
    COUNT(*) as failure_count,
    STRING_AGG(DISTINCT company_name, ', ') as affected_companies,
    'Multiple audit failures detected in last hour - possible systemic issue' as message
FROM ai_visibility_audits
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '1 hour'
HAVING COUNT(*) >= 3;

-- Alert 5: Critical - Unknown Company in Dashboard
SELECT
    'CRITICAL' as severity,
    'Data Corruption' as alert_type,
    audit_id,
    company_id,
    created_at,
    'Dashboard populated with "Unknown Company" - silent failure detected' as message
FROM dashboard_data
WHERE company_name = 'Unknown Company'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;


-- DASHBOARD 7: Business Intelligence Queries
-- ═══════════════════════════════════════════════════════════════════════════════

-- Query 7.1: Overall System Health Scorecard
SELECT
    (SELECT COUNT(*) FROM ai_visibility_audits WHERE created_at > NOW() - INTERVAL '7 days') as total_audits_7d,
    (SELECT COUNT(*) FROM ai_visibility_audits WHERE status = 'completed' AND created_at > NOW() - INTERVAL '7 days') as completed_7d,
    (SELECT COUNT(*) FROM ai_visibility_audits WHERE status = 'failed' AND created_at > NOW() - INTERVAL '7 days') as failed_7d,
    (SELECT COUNT(*) FROM ai_visibility_audits WHERE status = 'completed' AND overall_score = 0 AND created_at > NOW() - INTERVAL '7 days') as zero_scores_7d,
    (SELECT ROUND(AVG(overall_score), 2) FROM ai_visibility_audits WHERE status = 'completed' AND created_at > NOW() - INTERVAL '7 days') as avg_score_7d,
    (SELECT ROUND(AVG(brand_mention_rate), 2) FROM ai_visibility_audits WHERE status = 'completed' AND created_at > NOW() - INTERVAL '7 days') as avg_detection_7d,
    (SELECT COUNT(DISTINCT company_id) FROM ai_visibility_audits WHERE created_at > NOW() - INTERVAL '7 days') as unique_companies_7d;

-- Query 7.2: Company Success Rate
SELECT
    c.id as company_id,
    c.name as company_name,
    COUNT(a.id) as total_audits,
    SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) as completed,
    SUM(CASE WHEN a.status = 'failed' THEN 1 ELSE 0 END) as failed,
    ROUND(SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(a.id), 2) as success_rate,
    ROUND(AVG(CASE WHEN a.status = 'completed' THEN a.overall_score END), 2) as avg_score,
    MAX(a.created_at) as last_audit_date
FROM companies c
LEFT JOIN ai_visibility_audits a ON c.id = a.company_id
WHERE a.created_at > NOW() - INTERVAL '90 days'
GROUP BY c.id, c.name
HAVING COUNT(a.id) > 0
ORDER BY success_rate DESC, total_audits DESC;


-- ═══════════════════════════════════════════════════════════════════════════════
-- Usage Instructions
-- ═══════════════════════════════════════════════════════════════════════════════

/*
RECOMMENDED MONITORING SCHEDULE:

1. Real-time Alerts (Check every 5 minutes):
   - Alert 1: Zero Score Audits
   - Alert 2: Low Brand Detection
   - Alert 3: Stuck Audits
   - Alert 5: Unknown Company

2. Hourly Checks:
   - Query 1.2: Zero Score Audits
   - Query 2.3: Brand Detection Trends
   - Query 3.1: Suspicious Patterns

3. Daily Reports:
   - Query 7.1: System Health Scorecard
   - Query 1.4: Audit Completion Rate
   - Query 2.1: Brand Detection Distribution

4. Weekly Reviews:
   - Query 7.2: Company Success Rate
   - Query 4.1: Error Message Analysis
   - Query 5.1: Performance Metrics

INTEGRATION TIPS:
- Connect to Grafana/Datadog for visualization
- Set up PagerDuty/Slack alerts for critical queries
- Export to CSV for executive reports
- Use as basis for automated health checks
*/