-- Migration 008: Safely add company_logo_url to dashboard_data
-- Handles existing databases without crashing

-- Add column only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'dashboard_data'
        AND column_name = 'company_logo_url'
    ) THEN
        ALTER TABLE dashboard_data
        ADD COLUMN company_logo_url TEXT;

        RAISE NOTICE 'Added company_logo_url column to dashboard_data';
    ELSE
        RAISE NOTICE 'Column company_logo_url already exists, skipping';
    END IF;
END $$;

-- Create index only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'dashboard_data'
        AND indexname = 'idx_dashboard_logo'
    ) THEN
        CREATE INDEX idx_dashboard_logo ON dashboard_data(company_logo_url)
        WHERE company_logo_url IS NOT NULL;

        RAISE NOTICE 'Created index idx_dashboard_logo';
    ELSE
        RAISE NOTICE 'Index idx_dashboard_logo already exists, skipping';
    END IF;
END $$;

-- Verify the changes
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'dashboard_data'
AND column_name = 'company_logo_url';
