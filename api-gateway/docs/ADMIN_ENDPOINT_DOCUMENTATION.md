# Admin All Companies Endpoint Documentation

## Critical Endpoint: `/api/test/admin/all-companies`

### Problem Solved
The admin dashboard was showing "Not set" for company names and user data because the API wasn't properly joining the `onboarding_sessions` table with the `companies` table. Companies created through the onboarding flow store their journey data in `onboarding_sessions`, which needs to be matched back to the company records.

### Solution Overview
Fixed the SQL query to properly JOIN companies with their onboarding sessions using domain-based matching and multiple fallback methods for user identification.

## Database Schema Dependencies

### Tables Used
1. **companies** - Core company data
   - `id`, `name`, `domain`, `description`, `industry`
   - `latest_geo_score`, `user_edited`, `data_completeness`, `confidence_score`
   - `created_by`, `created_at`

2. **onboarding_sessions** - Journey data from onboarding
   - `session_id` (contains domain in format)
   - `email`, `status`, `created_at`, `completed_at`
   - `original_company_data` (JSONB)
   - `edited_company_data` (JSONB)
   - `final_company_data` (JSONB)
   - `suggested_competitors`, `user_added_competitors`, `removed_competitors`, `final_competitors`
   - `total_edits`, `description_edit_count`
   - `time_on_company_step`, `time_on_description_step`, `time_on_competitor_step`

3. **users** - User accounts
   - `id`, `email`, `company_id`

4. **user_tracking** - Dashboard readiness tracking
   - `email`, `company_id`, `dashboard_ready`, `dashboard_url`, `email_sent`

5. **user_dashboards** - Dashboard metadata
   - `user_email`, `dashboard_status`, `dashboard_id`

6. **ai_queries** - Generated queries (for counting)
   - `company_id`

## Critical JOIN Logic

### The Key Fix
```sql
LEFT JOIN onboarding_sessions os ON 
  os.session_id LIKE '%' || c.domain || '%'  -- Domain matching in session_id
  OR os.email = COALESCE(u.email, c.created_by)  -- Email matching
  OR (os.company_data->>'domain' = c.domain)  -- JSONB domain matching
```

### Why This Works
1. **Domain Matching**: Session IDs often contain the company domain
2. **Email Fallback**: Matches by user email when available
3. **JSONB Backup**: Some sessions store domain in the company_data field

## Fields Extracted from Onboarding Sessions

### Journey Names
- `original_name`: `os.original_company_data->>'name'`
- `current_name`: `os.edited_company_data->>'name'`
- `final_name`: `os.final_company_data->>'name'`

### Journey Descriptions
- `original_description`: `os.original_company_data->>'description'`
- `current_description`: `os.edited_company_data->>'description'`
- `final_description`: `os.final_company_data->>'description'`

### Competitor Journey
Built as a JSON object:
```sql
jsonb_build_object(
  'suggested', os.suggested_competitors,
  'added', os.user_added_competitors,
  'removed', os.removed_competitors,
  'final', os.final_competitors
)
```

### Edit Tracking
- `edit_count`: From `os.total_edits`
- `description_edit_count`: Direct field
- Time tracking for each step

## Journey Status Logic
```sql
CASE 
  WHEN ut.dashboard_ready THEN 'Dashboard Ready'
  WHEN (SELECT COUNT(*) FROM ai_queries WHERE company_id = c.id) >= 48 THEN 'Queries Complete'
  WHEN (SELECT COUNT(*) FROM ai_queries WHERE company_id = c.id) > 0 THEN 'Generating Queries'
  WHEN c.id IS NOT NULL THEN 'Company Created'
  ELSE 'Onboarding'
END as journey_status
```

## Important Notes

### User Email Resolution
Uses COALESCE to find user email from multiple sources:
```sql
COALESCE(os.email, u.email, c.created_by) as user_email
```

### User ID Resolution
Attempts to find user ID even when user record doesn't exist:
```sql
COALESCE(u.id, (SELECT id FROM users WHERE email = os.email LIMIT 1)) as user_id
```

## Files Modified
1. `/api-gateway/src/routes/test-queries.routes.ts` - Main endpoint implementation
2. `/api-gateway/src/queries/admin-all-companies.sql` - Backup of working query

## Testing the Endpoint
```bash
# Test the endpoint
curl http://localhost:4000/api/test/admin/all-companies | jq '.companies[0]'

# Verify specific company
curl http://localhost:4000/api/test/admin/all-companies | jq '.companies[] | select(.company_name == "Bikanervala Foods Pvt. Ltd.")'
```

## What Can Break This

### DO NOT:
1. Modify the JOIN conditions without understanding the domain matching logic
2. Remove the COALESCE statements - they handle null values gracefully
3. Change the JSONB field extraction syntax
4. Alter the table structure without updating the query

### WATCH OUT FOR:
1. Changes to `onboarding_sessions` table structure
2. Changes to how session_id is formatted
3. Modifications to the JSONB structure in company_data fields
4. New required fields in the frontend that aren't in the query

## Frontend Expectations
The admin dashboard at `/services/dashboard/app/admin/page.tsx` expects these exact field names:
- `original_name`, `current_name`, `final_name`
- `user_email`, `user_id`
- `competitor_journey` (as a JSON object)
- `journey_status`
- All other company fields

## Maintenance Tips
1. Always test with both companies that have onboarding sessions AND those without
2. Use the backup query at `/api-gateway/src/queries/admin-all-companies.sql` as reference
3. Monitor for null values in critical fields
4. Keep the detailed comments in the route file

## Performance Considerations
- The query uses LEFT JOINs to ensure all companies are returned
- Subqueries for counting AI queries may impact performance with large datasets
- Consider adding indexes on frequently joined columns:
  - `companies.domain`
  - `onboarding_sessions.session_id`
  - `onboarding_sessions.email`