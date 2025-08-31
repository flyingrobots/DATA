-- Utility functions used throughout the application

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION app.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to generate a unique slug
CREATE OR REPLACE FUNCTION app.generate_unique_slug(
    base_text TEXT,
    table_name TEXT,
    column_name TEXT DEFAULT 'slug'
)
RETURNS TEXT AS $$
DECLARE
    slug TEXT;
    counter INTEGER := 0;
    slug_exists BOOLEAN;
BEGIN
    -- Convert to lowercase and replace non-alphanumeric with hyphens
    slug := lower(regexp_replace(base_text, '[^a-zA-Z0-9]+', '-', 'g'));
    slug := trim(both '-' from slug);
    
    LOOP
        IF counter > 0 THEN
            slug := slug || '-' || counter::TEXT;
        END IF;
        
        EXECUTE format(
            'SELECT EXISTS(SELECT 1 FROM %I WHERE %I = $1)',
            table_name,
            column_name
        ) INTO slug_exists USING slug;
        
        EXIT WHEN NOT slug_exists;
        counter := counter + 1;
    END LOOP;
    
    RETURN slug;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate donation statistics
CREATE OR REPLACE FUNCTION app.calculate_campaign_stats(campaign_id UUID)
RETURNS TABLE (
    total_raised DECIMAL(12,2),
    donor_count BIGINT,
    average_donation DECIMAL(12,2),
    last_donation_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(amount), 0)::DECIMAL(12,2) as total_raised,
        COUNT(DISTINCT COALESCE(donor_id::TEXT, donor_email)) as donor_count,
        COALESCE(AVG(amount), 0)::DECIMAL(12,2) as average_donation,
        MAX(completed_at) as last_donation_at
    FROM app.donations
    WHERE app.donations.campaign_id = $1
        AND status = 'completed';
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if user is organization member
CREATE OR REPLACE FUNCTION app.is_organization_member(
    user_id UUID,
    organization_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM app.organization_members 
        WHERE app.organization_members.user_id = $1
            AND app.organization_members.organization_id = $2
            AND deleted_at IS NULL
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to get user's organizations
CREATE OR REPLACE FUNCTION app.get_user_organizations(user_id UUID)
RETURNS SETOF app.organizations AS $$
BEGIN
    RETURN QUERY
    SELECT o.*
    FROM app.organizations o
    INNER JOIN app.organization_members om ON om.organization_id = o.id
    WHERE om.user_id = $1
        AND om.deleted_at IS NULL
        AND o.deleted_at IS NULL
    ORDER BY o.name;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;