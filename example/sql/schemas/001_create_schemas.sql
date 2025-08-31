-- Create application schemas
-- These organize the database into logical domains

-- Public schema is default, used for Supabase auth
-- CREATE SCHEMA IF NOT EXISTS public;

-- Application data schema
CREATE SCHEMA IF NOT EXISTS app;
COMMENT ON SCHEMA app IS 'Core application tables and functions';

-- Billing and payments schema
CREATE SCHEMA IF NOT EXISTS billing;
COMMENT ON SCHEMA billing IS 'Payment processing and subscription management';

-- Analytics schema for reporting
CREATE SCHEMA IF NOT EXISTS analytics;
COMMENT ON SCHEMA analytics IS 'Materialized views and aggregated data for reporting';

-- Audit schema for compliance
CREATE SCHEMA IF NOT EXISTS audit;
COMMENT ON SCHEMA audit IS 'Audit logs and compliance tracking';

-- Grant usage to authenticated users
GRANT USAGE ON SCHEMA app TO authenticated;
GRANT USAGE ON SCHEMA billing TO authenticated;
GRANT USAGE ON SCHEMA analytics TO authenticated;
-- Audit schema restricted to service role only

-- Set search path for application
ALTER DATABASE postgres SET search_path TO public, app, extensions;