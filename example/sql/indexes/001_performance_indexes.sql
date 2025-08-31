-- Performance indexes for common queries

-- Composite indexes for common query patterns
CREATE INDEX idx_donations_campaign_status_date 
    ON app.donations(campaign_id, status, created_at DESC)
    WHERE status = 'completed';

CREATE INDEX idx_campaigns_org_status_featured 
    ON app.campaigns(organization_id, status, is_featured DESC)
    WHERE deleted_at IS NULL;

-- Partial indexes for active records
CREATE INDEX idx_active_organizations 
    ON app.organizations(status, created_at DESC)
    WHERE status = 'active' AND deleted_at IS NULL;

CREATE INDEX idx_active_campaigns_by_date 
    ON app.campaigns(start_date, end_date)
    WHERE status = 'active' AND deleted_at IS NULL;

-- BRIN indexes for time-series data
CREATE INDEX idx_donations_created_brin 
    ON app.donations USING BRIN(created_at);

CREATE INDEX idx_audit_log_changed_brin 
    ON audit.change_log USING BRIN(changed_at);

-- GIN indexes for JSONB columns
CREATE INDEX idx_organizations_settings_gin 
    ON app.organizations USING gin(settings);

CREATE INDEX idx_campaigns_metadata_gin 
    ON app.campaigns USING gin(metadata);

CREATE INDEX idx_donations_metadata_gin 
    ON app.donations USING gin(metadata);

-- Trigram indexes for fuzzy search
CREATE INDEX idx_organizations_name_trgm 
    ON app.organizations USING gin(name gin_trgm_ops);

CREATE INDEX idx_campaigns_title_trgm 
    ON app.campaigns USING gin(title gin_trgm_ops);

-- Covering indexes for common queries
CREATE INDEX idx_donations_covering 
    ON app.donations(campaign_id, status, created_at DESC) 
    INCLUDE (amount, donor_id, donor_email);

CREATE INDEX idx_campaigns_covering 
    ON app.campaigns(organization_id, status) 
    INCLUDE (title, goal_amount, raised_amount, end_date)
    WHERE deleted_at IS NULL;

-- Geographic indexes (if using PostGIS)
-- CREATE INDEX idx_organizations_location 
--     ON app.organizations USING GIST(location);

-- Hash indexes for exact matches (PostgreSQL 10+)
CREATE INDEX idx_donations_transaction_hash 
    ON app.donations USING hash(transaction_id);

CREATE INDEX idx_organizations_slug_hash 
    ON app.organizations USING hash(slug)
    WHERE deleted_at IS NULL;

-- Statistics for query planning
ANALYZE app.organizations;
ANALYZE app.campaigns;
ANALYZE app.donations;
ANALYZE audit.change_log;