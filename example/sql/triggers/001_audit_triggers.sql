-- Audit triggers for tracking changes

-- Create audit log table
CREATE TABLE IF NOT EXISTS audit.change_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    changed_by UUID REFERENCES auth.users(id),
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    user_agent TEXT
);

-- Index for querying audit logs
CREATE INDEX idx_audit_log_table ON audit.change_log(table_name, changed_at DESC);
CREATE INDEX idx_audit_log_record ON audit.change_log(record_id, changed_at DESC);
CREATE INDEX idx_audit_log_user ON audit.change_log(changed_by, changed_at DESC);

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION audit.log_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_old_data JSONB;
    v_new_data JSONB;
    v_user_id UUID;
BEGIN
    -- Get current user ID from JWT claims or session
    v_user_id := COALESCE(
        current_setting('request.jwt.claims', true)::jsonb->>'sub',
        current_setting('request.session.user_id', true)
    )::UUID;
    
    IF TG_OP = 'DELETE' THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := NULL;
        
        INSERT INTO audit.change_log (
            table_name,
            record_id,
            action,
            changed_by,
            old_data,
            new_data,
            ip_address,
            user_agent
        ) VALUES (
            TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
            OLD.id,
            TG_OP,
            v_user_id,
            v_old_data,
            v_new_data,
            inet_client_addr(),
            current_setting('request.headers', true)::jsonb->>'user-agent'
        );
        
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        
        -- Only log if there are actual changes
        IF v_old_data != v_new_data THEN
            INSERT INTO audit.change_log (
                table_name,
                record_id,
                action,
                changed_by,
                old_data,
                new_data,
                ip_address,
                user_agent
            ) VALUES (
                TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
                NEW.id,
                TG_OP,
                v_user_id,
                v_old_data,
                v_new_data,
                inet_client_addr(),
                current_setting('request.headers', true)::jsonb->>'user-agent'
            );
        END IF;
        
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        v_old_data := NULL;
        v_new_data := to_jsonb(NEW);
        
        INSERT INTO audit.change_log (
            table_name,
            record_id,
            action,
            changed_by,
            old_data,
            new_data,
            ip_address,
            user_agent
        ) VALUES (
            TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
            NEW.id,
            TG_OP,
            v_user_id,
            v_old_data,
            v_new_data,
            inet_client_addr(),
            current_setting('request.headers', true)::jsonb->>'user-agent'
        );
        
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers to sensitive tables
CREATE TRIGGER audit_organizations
    AFTER INSERT OR UPDATE OR DELETE ON app.organizations
    FOR EACH ROW EXECUTE FUNCTION audit.log_changes();

CREATE TRIGGER audit_campaigns
    AFTER INSERT OR UPDATE OR DELETE ON app.campaigns
    FOR EACH ROW EXECUTE FUNCTION audit.log_changes();

CREATE TRIGGER audit_donations
    AFTER INSERT OR UPDATE OR DELETE ON app.donations
    FOR EACH ROW EXECUTE FUNCTION audit.log_changes();

-- Trigger to update campaign stats after donation changes
CREATE OR REPLACE FUNCTION app.update_campaign_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Update campaign stats when donation is completed
        IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status != 'completed') THEN
            UPDATE app.campaigns
            SET 
                raised_amount = (
                    SELECT COALESCE(SUM(amount), 0)
                    FROM app.donations
                    WHERE campaign_id = NEW.campaign_id
                        AND status = 'completed'
                ),
                donor_count = (
                    SELECT COUNT(DISTINCT COALESCE(donor_id::TEXT, donor_email))
                    FROM app.donations
                    WHERE campaign_id = NEW.campaign_id
                        AND status = 'completed'
                )
            WHERE id = NEW.campaign_id;
        END IF;
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.status = 'completed' THEN
            UPDATE app.campaigns
            SET 
                raised_amount = GREATEST(0, raised_amount - OLD.amount),
                donor_count = (
                    SELECT COUNT(DISTINCT COALESCE(donor_id::TEXT, donor_email))
                    FROM app.donations
                    WHERE campaign_id = OLD.campaign_id
                        AND status = 'completed'
                )
            WHERE id = OLD.campaign_id;
        END IF;
        
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_campaign_stats_trigger
    AFTER INSERT OR UPDATE OR DELETE ON app.donations
    FOR EACH ROW EXECUTE FUNCTION app.update_campaign_stats();