-- Add recommendations column to audit_responses table
ALTER TABLE audit_responses
ADD COLUMN IF NOT EXISTS recommendations JSONB;

-- Add recommendations column to ai_responses table  
ALTER TABLE ai_responses
ADD COLUMN IF NOT EXISTS recommendations JSONB;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_audit_responses_recommendations 
ON audit_responses USING gin(recommendations);

CREATE INDEX IF NOT EXISTS idx_ai_responses_recommendations
ON ai_responses USING gin(recommendations);

-- Add comment to describe the column structure
COMMENT ON COLUMN audit_responses.recommendations IS 
'JSON array of recommendation objects with structure: 
{
  "text": "Recommendation text",
  "category": "SEO|Content Strategy|Brand Positioning|etc",
  "priority": 1-10,
  "impact": "Low|Medium|High|Critical", 
  "difficulty": "Easy|Moderate|Hard|Complex",
  "action_items": ["Action 1", "Action 2"],
  "success_metrics": ["Metric 1", "Metric 2"],
  "competitive_advantage": "Description",
  "implementation_timeline": "Immediate|Short-term|Medium-term|Long-term"
}';

COMMENT ON COLUMN ai_responses.recommendations IS 
'JSON array of recommendation objects with structure: 
{
  "text": "Recommendation text",
  "category": "SEO|Content Strategy|Brand Positioning|etc",
  "priority": 1-10,
  "impact": "Low|Medium|High|Critical",
  "difficulty": "Easy|Moderate|Hard|Complex",
  "action_items": ["Action 1", "Action 2"],
  "success_metrics": ["Metric 1", "Metric 2"],
  "competitive_advantage": "Description",
  "implementation_timeline": "Immediate|Short-term|Medium-term|Long-term"
}';