-- Link users to companies based on email

-- Update user_tracking with company_id based on companies table
UPDATE user_tracking ut
SET company_id = c.id
FROM companies c
WHERE ut.email = c.created_by
AND ut.company_id IS NULL;

-- If created_by doesn't exist in companies, add it
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);

-- Update companies with creator email from onboarding_sessions
UPDATE companies c
SET created_by = os.email
FROM onboarding_sessions os
WHERE os.company_data->>'domain' = c.domain
AND c.created_by IS NULL;

-- Now link user_tracking to companies
UPDATE user_tracking ut
SET company_id = c.id
FROM companies c
WHERE ut.email = c.created_by
AND ut.company_id IS NULL;

-- Also try to link by matching domains in company_data
UPDATE user_tracking ut
SET company_id = c.id
FROM onboarding_sessions os
JOIN companies c ON os.company_data->>'domain' = c.domain
WHERE ut.email = os.email
AND ut.company_id IS NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_companies_created_by ON companies(created_by);