-- Seed data for development and testing

-- Insert test organizations
INSERT INTO app.organizations (id, slug, name, description, email, status) VALUES
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'save-the-ocean', 'Save The Ocean Foundation', 'Dedicated to ocean conservation and marine life protection', 'contact@savetheocean.org', 'active'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'tech-for-good', 'Tech For Good', 'Using technology to solve social problems', 'hello@techforgood.org', 'active'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'local-food-bank', 'Local Food Bank Network', 'Fighting hunger in our community', 'info@localfoodbank.org', 'active')
ON CONFLICT (id) DO NOTHING;

-- Insert test campaigns
INSERT INTO app.campaigns (id, organization_id, slug, title, description, goal_amount, start_date, end_date, status) VALUES
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'coral-restoration', 'Coral Reef Restoration Project', 'Help us restore 10,000 square meters of coral reef', 50000.00, CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '60 days', 'active'),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'plastic-cleanup', 'Ocean Plastic Cleanup Drive', 'Remove 100 tons of plastic from the ocean', 75000.00, CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE + INTERVAL '45 days', 'active'),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'coding-bootcamp', 'Free Coding Bootcamp for Underserved Youth', 'Provide free programming education to 100 students', 100000.00, CURRENT_DATE, CURRENT_DATE + INTERVAL '90 days', 'active'),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'holiday-meals', 'Holiday Meals for Families', 'Provide holiday meals for 1000 families in need', 25000.00, CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '25 days', 'active')
ON CONFLICT (id) DO NOTHING;

-- Insert sample completed donations
DO $$
DECLARE
    v_campaign_id UUID;
    v_donation_count INTEGER;
    v_amount DECIMAL(12,2);
BEGIN
    -- Generate donations for each campaign
    FOR v_campaign_id IN 
        SELECT id FROM app.campaigns WHERE status = 'active'
    LOOP
        -- Random number of donations per campaign (10-50)
        v_donation_count := floor(random() * 40 + 10)::INTEGER;
        
        FOR i IN 1..v_donation_count LOOP
            -- Random donation amount between $10 and $500
            v_amount := round((random() * 490 + 10)::NUMERIC, 2);
            
            INSERT INTO app.donations (
                campaign_id,
                amount,
                status,
                donor_email,
                donor_name,
                is_anonymous,
                message,
                created_at,
                completed_at,
                payment_method
            ) VALUES (
                v_campaign_id,
                v_amount,
                'completed',
                'donor' || i || '@example.com',
                'Test Donor ' || i,
                random() < 0.2, -- 20% anonymous
                CASE WHEN random() < 0.3 THEN 'Keep up the great work!' ELSE NULL END,
                NOW() - (random() * INTERVAL '30 days'),
                NOW() - (random() * INTERVAL '30 days'),
                (ARRAY['card', 'paypal', 'bank_transfer'])[floor(random() * 3 + 1)]::billing.payment_method
            );
        END LOOP;
        
        -- Update campaign raised_amount and donor_count
        UPDATE app.campaigns
        SET 
            raised_amount = (
                SELECT COALESCE(SUM(amount), 0)
                FROM app.donations
                WHERE campaign_id = v_campaign_id AND status = 'completed'
            ),
            donor_count = (
                SELECT COUNT(DISTINCT donor_email)
                FROM app.donations
                WHERE campaign_id = v_campaign_id AND status = 'completed'
            )
        WHERE id = v_campaign_id;
    END LOOP;
END $$;

-- Add some featured campaigns
UPDATE app.campaigns 
SET is_featured = true 
WHERE slug IN ('coral-restoration', 'coding-bootcamp');

-- Create test webhook endpoints (for Edge Functions integration)
CREATE TABLE IF NOT EXISTS app.webhook_endpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES app.organizations(id),
    url TEXT NOT NULL,
    events app.webhook_event_type[] NOT NULL,
    is_active BOOLEAN DEFAULT true,
    secret_key TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_triggered_at TIMESTAMPTZ
);

INSERT INTO app.webhook_endpoints (organization_id, url, events) VALUES
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'https://example.com/webhooks/donations', ARRAY['donation.completed'::app.webhook_event_type]),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'https://example.com/webhooks/all', ARRAY['donation.created'::app.webhook_event_type, 'donation.completed'::app.webhook_event_type])
ON CONFLICT DO NOTHING;