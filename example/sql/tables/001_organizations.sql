-- Organizations table - core entity for donation recipients

CREATE TABLE app.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9-]+$'),
    name TEXT NOT NULL,
    description TEXT,
    logo_url TEXT,
    website_url TEXT,
    status app.organization_status DEFAULT 'pending_verification',
    
    -- Contact information
    email TEXT NOT NULL,
    phone TEXT,
    
    -- Address
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state_province TEXT,
    postal_code TEXT,
    country_code CHAR(2),
    
    -- Tax information
    tax_id TEXT,
    is_tax_exempt BOOLEAN DEFAULT false,
    tax_exempt_id TEXT,
    
    -- Metadata
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Soft delete
    deleted_at TIMESTAMPTZ,
    
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indexes for performance
CREATE INDEX idx_organizations_slug ON app.organizations(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_organizations_status ON app.organizations(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_organizations_created_by ON app.organizations(created_by);
CREATE INDEX idx_organizations_country ON app.organizations(country_code) WHERE deleted_at IS NULL;

-- Full-text search
CREATE INDEX idx_organizations_search ON app.organizations 
    USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Enable RLS
ALTER TABLE app.organizations ENABLE ROW LEVEL SECURITY;

-- Add trigger for updated_at
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON app.organizations
    FOR EACH ROW
    EXECUTE FUNCTION app.update_updated_at_column();