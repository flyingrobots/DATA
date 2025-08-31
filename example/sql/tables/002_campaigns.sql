-- Campaigns table - fundraising campaigns run by organizations

CREATE TABLE app.campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    
    -- Financial goals
    goal_amount DECIMAL(12,2) NOT NULL CHECK (goal_amount > 0),
    currency_code CHAR(3) DEFAULT 'USD',
    raised_amount DECIMAL(12,2) DEFAULT 0 CHECK (raised_amount >= 0),
    donor_count INTEGER DEFAULT 0 CHECK (donor_count >= 0),
    
    -- Campaign timeline
    start_date DATE NOT NULL,
    end_date DATE,
    status app.campaign_status DEFAULT 'draft',
    
    -- Media
    cover_image_url TEXT,
    video_url TEXT,
    gallery JSONB DEFAULT '[]',
    
    -- Settings
    is_featured BOOLEAN DEFAULT false,
    allow_anonymous BOOLEAN DEFAULT true,
    min_donation_amount DECIMAL(12,2) DEFAULT 1.00,
    max_donation_amount DECIMAL(12,2),
    
    -- Metadata
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Soft delete
    deleted_at TIMESTAMPTZ,
    
    -- Unique slug per organization
    CONSTRAINT unique_campaign_slug UNIQUE (organization_id, slug),
    CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date >= start_date),
    CONSTRAINT valid_donation_range CHECK (
        max_donation_amount IS NULL OR 
        max_donation_amount >= min_donation_amount
    )
);

-- Indexes
CREATE INDEX idx_campaigns_organization ON app.campaigns(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_campaigns_status ON app.campaigns(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_campaigns_featured ON app.campaigns(is_featured) WHERE deleted_at IS NULL AND status = 'active';
CREATE INDEX idx_campaigns_dates ON app.campaigns(start_date, end_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_campaigns_tags ON app.campaigns USING gin(tags);

-- Full-text search
CREATE INDEX idx_campaigns_search ON app.campaigns 
    USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- Enable RLS
ALTER TABLE app.campaigns ENABLE ROW LEVEL SECURITY;