-- Row Level Security Policies

-- Organizations policies
CREATE POLICY "Public organizations are viewable by everyone"
    ON app.organizations FOR SELECT
    USING (status = 'active' AND deleted_at IS NULL);

CREATE POLICY "Organization members can view their org"
    ON app.organizations FOR SELECT
    USING (
        auth.uid() IN (
            SELECT user_id FROM app.organization_members
            WHERE organization_id = id AND deleted_at IS NULL
        )
    );

CREATE POLICY "Organization owners can update their org"
    ON app.organizations FOR UPDATE
    USING (
        auth.uid() IN (
            SELECT user_id FROM app.organization_members
            WHERE organization_id = id 
                AND role IN ('owner', 'admin')
                AND deleted_at IS NULL
        )
    );

-- Campaigns policies
CREATE POLICY "Active campaigns are viewable by everyone"
    ON app.campaigns FOR SELECT
    USING (
        status IN ('active', 'completed') 
        AND deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM app.organizations
            WHERE id = organization_id
                AND status = 'active'
                AND deleted_at IS NULL
        )
    );

CREATE POLICY "Organization members can manage campaigns"
    ON app.campaigns FOR ALL
    USING (
        auth.uid() IN (
            SELECT user_id FROM app.organization_members
            WHERE organization_id = campaigns.organization_id
                AND deleted_at IS NULL
        )
    );

-- Donations policies
CREATE POLICY "Users can view their own donations"
    ON app.donations FOR SELECT
    USING (donor_id = auth.uid());

CREATE POLICY "Organization members can view donations to their campaigns"
    ON app.donations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM app.campaigns c
            INNER JOIN app.organization_members om ON om.organization_id = c.organization_id
            WHERE c.id = campaign_id
                AND om.user_id = auth.uid()
                AND om.deleted_at IS NULL
        )
    );

CREATE POLICY "Anyone can create donations"
    ON app.donations FOR INSERT
    WITH CHECK (true);

CREATE POLICY "System can update donation status"
    ON app.donations FOR UPDATE
    USING (
        -- Only service role or the donation processor can update
        auth.role() = 'service_role' OR
        (donor_id = auth.uid() AND status = 'pending')
    );

-- Audit log policies (restricted)
CREATE POLICY "Only service role can insert audit logs"
    ON audit.change_log FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can view their own audit logs"
    ON audit.change_log FOR SELECT
    USING (changed_by = auth.uid());

CREATE POLICY "Organization admins can view org audit logs"
    ON audit.change_log FOR SELECT
    USING (
        table_name LIKE 'app.%' AND
        EXISTS (
            SELECT 1 FROM app.organization_members
            WHERE user_id = auth.uid()
                AND role IN ('owner', 'admin')
                AND deleted_at IS NULL
                AND organization_id IN (
                    SELECT organization_id FROM app.campaigns WHERE id = record_id
                    UNION
                    SELECT id FROM app.organizations WHERE id = record_id
                    UNION
                    SELECT c.organization_id FROM app.donations d
                    INNER JOIN app.campaigns c ON c.id = d.campaign_id
                    WHERE d.id = record_id
                )
        )
    );

-- Helper function for checking permissions
CREATE OR REPLACE FUNCTION app.check_permission(
    p_user_id UUID,
    p_organization_id UUID,
    p_required_role TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_member_role TEXT;
BEGIN
    SELECT role INTO v_member_role
    FROM app.organization_members
    WHERE user_id = p_user_id
        AND organization_id = p_organization_id
        AND deleted_at IS NULL;
    
    IF v_member_role IS NULL THEN
        RETURN FALSE;
    END IF;
    
    IF p_required_role IS NULL THEN
        RETURN TRUE;
    END IF;
    
    -- Role hierarchy: owner > admin > member
    CASE p_required_role
        WHEN 'member' THEN
            RETURN v_member_role IN ('member', 'admin', 'owner');
        WHEN 'admin' THEN
            RETURN v_member_role IN ('admin', 'owner');
        WHEN 'owner' THEN
            RETURN v_member_role = 'owner';
        ELSE
            RETURN FALSE;
    END CASE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;