-- Functions for handling donation processing

-- Process a donation payment
CREATE OR REPLACE FUNCTION app.process_donation(
    p_donation_id UUID,
    p_payment_intent_id TEXT,
    p_transaction_id TEXT
)
RETURNS app.donations AS $$
DECLARE
    v_donation app.donations;
    v_campaign app.campaigns;
BEGIN
    -- Lock the donation row
    SELECT * INTO v_donation
    FROM app.donations
    WHERE id = p_donation_id
    FOR UPDATE;
    
    IF v_donation IS NULL THEN
        RAISE EXCEPTION 'Donation not found: %', p_donation_id;
    END IF;
    
    IF v_donation.status != 'pending' THEN
        RAISE EXCEPTION 'Donation is not in pending status: %', v_donation.status;
    END IF;
    
    -- Update donation status
    UPDATE app.donations
    SET 
        status = 'processing',
        payment_intent_id = p_payment_intent_id,
        transaction_id = p_transaction_id,
        processed_at = NOW()
    WHERE id = p_donation_id
    RETURNING * INTO v_donation;
    
    -- Update campaign totals (will be finalized when status = completed)
    SELECT * INTO v_campaign
    FROM app.campaigns
    WHERE id = v_donation.campaign_id
    FOR UPDATE;
    
    RETURN v_donation;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Complete a donation
CREATE OR REPLACE FUNCTION app.complete_donation(
    p_donation_id UUID,
    p_net_amount DECIMAL(12,2) DEFAULT NULL
)
RETURNS app.donations AS $$
DECLARE
    v_donation app.donations;
    v_campaign app.campaigns;
BEGIN
    -- Lock and update donation
    UPDATE app.donations
    SET 
        status = 'completed',
        completed_at = NOW(),
        net_amount = COALESCE(p_net_amount, amount)
    WHERE id = p_donation_id
        AND status = 'processing'
    RETURNING * INTO v_donation;
    
    IF v_donation IS NULL THEN
        RAISE EXCEPTION 'Donation not found or not in processing status: %', p_donation_id;
    END IF;
    
    -- Update campaign totals
    UPDATE app.campaigns
    SET 
        raised_amount = raised_amount + v_donation.amount,
        donor_count = (
            SELECT COUNT(DISTINCT COALESCE(donor_id::TEXT, donor_email))
            FROM app.donations
            WHERE campaign_id = v_donation.campaign_id
                AND status = 'completed'
        )
    WHERE id = v_donation.campaign_id;
    
    RETURN v_donation;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Refund a donation
CREATE OR REPLACE FUNCTION app.refund_donation(
    p_donation_id UUID,
    p_refund_amount DECIMAL(12,2) DEFAULT NULL,
    p_reason TEXT DEFAULT NULL
)
RETURNS app.donations AS $$
DECLARE
    v_donation app.donations;
    v_refund_amount DECIMAL(12,2);
BEGIN
    -- Get donation
    SELECT * INTO v_donation
    FROM app.donations
    WHERE id = p_donation_id
    FOR UPDATE;
    
    IF v_donation IS NULL THEN
        RAISE EXCEPTION 'Donation not found: %', p_donation_id;
    END IF;
    
    IF v_donation.status != 'completed' THEN
        RAISE EXCEPTION 'Can only refund completed donations';
    END IF;
    
    v_refund_amount := COALESCE(p_refund_amount, v_donation.amount);
    
    IF v_refund_amount > v_donation.amount THEN
        RAISE EXCEPTION 'Refund amount cannot exceed donation amount';
    END IF;
    
    -- Update donation
    UPDATE app.donations
    SET 
        status = 'refunded',
        refunded_at = NOW(),
        metadata = metadata || jsonb_build_object(
            'refund_amount', v_refund_amount,
            'refund_reason', p_reason,
            'refunded_at', NOW()
        )
    WHERE id = p_donation_id
    RETURNING * INTO v_donation;
    
    -- Update campaign totals
    UPDATE app.campaigns
    SET 
        raised_amount = GREATEST(0, raised_amount - v_refund_amount)
    WHERE id = v_donation.campaign_id;
    
    RETURN v_donation;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get donation summary for a time period
CREATE OR REPLACE FUNCTION app.get_donation_summary(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_organization_id UUID DEFAULT NULL
)
RETURNS TABLE (
    total_donations BIGINT,
    total_amount DECIMAL(12,2),
    unique_donors BIGINT,
    average_donation DECIMAL(12,2),
    successful_rate NUMERIC(5,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_donations,
        COALESCE(SUM(CASE WHEN d.status = 'completed' THEN d.amount END), 0)::DECIMAL(12,2) as total_amount,
        COUNT(DISTINCT COALESCE(d.donor_id::TEXT, d.donor_email))::BIGINT as unique_donors,
        COALESCE(AVG(CASE WHEN d.status = 'completed' THEN d.amount END), 0)::DECIMAL(12,2) as average_donation,
        ROUND(
            100.0 * COUNT(CASE WHEN d.status = 'completed' THEN 1 END) / NULLIF(COUNT(*), 0),
            2
        )::NUMERIC(5,2) as successful_rate
    FROM app.donations d
    INNER JOIN app.campaigns c ON c.id = d.campaign_id
    WHERE d.created_at >= p_start_date
        AND d.created_at < p_end_date
        AND (p_organization_id IS NULL OR c.organization_id = p_organization_id);
END;
$$ LANGUAGE plpgsql STABLE;