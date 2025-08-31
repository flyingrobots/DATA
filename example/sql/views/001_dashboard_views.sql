-- Views for dashboard and reporting

-- Active campaigns view
CREATE OR REPLACE VIEW app.v_active_campaigns AS
SELECT 
    c.id,
    c.slug,
    c.title,
    c.description,
    c.goal_amount,
    c.raised_amount,
    c.donor_count,
    ROUND(100.0 * c.raised_amount / NULLIF(c.goal_amount, 0), 2) as completion_percentage,
    c.start_date,
    c.end_date,
    c.end_date - CURRENT_DATE as days_remaining,
    c.cover_image_url,
    c.is_featured,
    o.id as organization_id,
    o.slug as organization_slug,
    o.name as organization_name,
    o.logo_url as organization_logo
FROM app.campaigns c
INNER JOIN app.organizations o ON o.id = c.organization_id
WHERE c.status = 'active'
    AND c.deleted_at IS NULL
    AND o.deleted_at IS NULL
    AND o.status = 'active'
    AND c.start_date <= CURRENT_DATE
    AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE);

-- Recent donations view
CREATE OR REPLACE VIEW app.v_recent_donations AS
SELECT 
    d.id,
    d.amount,
    d.currency_code,
    d.created_at,
    d.is_anonymous,
    CASE 
        WHEN d.is_anonymous THEN 'Anonymous'
        ELSE COALESCE(d.donor_name, u.raw_user_meta_data->>'full_name', 'Guest Donor')
    END as display_name,
    d.message,
    c.id as campaign_id,
    c.title as campaign_title,
    o.id as organization_id,
    o.name as organization_name
FROM app.donations d
INNER JOIN app.campaigns c ON c.id = d.campaign_id
INNER JOIN app.organizations o ON o.id = c.organization_id
LEFT JOIN auth.users u ON u.id = d.donor_id
WHERE d.status = 'completed'
ORDER BY d.completed_at DESC
LIMIT 100;

-- Organization statistics view
CREATE OR REPLACE VIEW app.v_organization_stats AS
SELECT 
    o.id,
    o.name,
    o.slug,
    COUNT(DISTINCT c.id) as total_campaigns,
    COUNT(DISTINCT CASE WHEN c.status = 'active' THEN c.id END) as active_campaigns,
    COUNT(DISTINCT d.id) as total_donations,
    COALESCE(SUM(d.amount), 0) as total_raised,
    COUNT(DISTINCT COALESCE(d.donor_id::TEXT, d.donor_email)) as unique_donors,
    MAX(d.completed_at) as last_donation_at
FROM app.organizations o
LEFT JOIN app.campaigns c ON c.organization_id = o.id AND c.deleted_at IS NULL
LEFT JOIN app.donations d ON d.campaign_id = c.id AND d.status = 'completed'
WHERE o.deleted_at IS NULL
GROUP BY o.id, o.name, o.slug;

-- Donor leaderboard view
CREATE OR REPLACE VIEW app.v_donor_leaderboard AS
WITH donor_totals AS (
    SELECT 
        COALESCE(d.donor_id::TEXT, d.donor_email) as donor_key,
        d.donor_id,
        d.donor_email,
        MAX(d.donor_name) as donor_name,
        MAX(d.is_anonymous) as is_anonymous,
        COUNT(*) as donation_count,
        SUM(d.amount) as total_amount,
        MAX(d.completed_at) as last_donation_at
    FROM app.donations d
    WHERE d.status = 'completed'
    GROUP BY COALESCE(d.donor_id::TEXT, d.donor_email), d.donor_id, d.donor_email
)
SELECT 
    dt.donor_id,
    CASE 
        WHEN dt.is_anonymous THEN 'Anonymous Donor'
        ELSE COALESCE(dt.donor_name, u.raw_user_meta_data->>'full_name', 'Guest Donor')
    END as display_name,
    dt.donation_count,
    dt.total_amount,
    dt.last_donation_at,
    ROW_NUMBER() OVER (ORDER BY dt.total_amount DESC) as rank
FROM donor_totals dt
LEFT JOIN auth.users u ON u.id = dt.donor_id
ORDER BY dt.total_amount DESC
LIMIT 100;

-- Campaign performance view
CREATE OR REPLACE VIEW app.v_campaign_performance AS
SELECT 
    c.id,
    c.title,
    c.status,
    c.goal_amount,
    c.raised_amount,
    c.donor_count,
    ROUND(100.0 * c.raised_amount / NULLIF(c.goal_amount, 0), 2) as goal_percentage,
    c.end_date - c.start_date as duration_days,
    CASE 
        WHEN c.end_date < CURRENT_DATE THEN 'completed'
        WHEN c.start_date > CURRENT_DATE THEN 'upcoming'
        ELSE 'active'
    END as time_status,
    c.raised_amount / NULLIF(EXTRACT(EPOCH FROM (LEAST(c.end_date, CURRENT_DATE) - c.start_date)) / 86400, 0) as daily_average,
    o.name as organization_name
FROM app.campaigns c
INNER JOIN app.organizations o ON o.id = c.organization_id
WHERE c.deleted_at IS NULL;