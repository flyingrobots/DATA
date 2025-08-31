-- Custom enum types for the application

-- User roles
CREATE TYPE app.user_role AS ENUM (
    'admin',
    'organization_owner', 
    'organization_member',
    'donor',
    'guest'
);

-- Organization status
CREATE TYPE app.organization_status AS ENUM (
    'pending_verification',
    'active',
    'suspended',
    'inactive'
);

-- Donation status
CREATE TYPE app.donation_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'refunded',
    'cancelled'
);

-- Payment methods
CREATE TYPE billing.payment_method AS ENUM (
    'card',
    'bank_transfer',
    'paypal',
    'crypto',
    'apple_pay',
    'google_pay'
);

-- Subscription tiers
CREATE TYPE billing.subscription_tier AS ENUM (
    'free',
    'starter',
    'professional',
    'enterprise'
);

-- Campaign status
CREATE TYPE app.campaign_status AS ENUM (
    'draft',
    'active',
    'paused',
    'completed',
    'cancelled'
);

-- Webhook event types
CREATE TYPE app.webhook_event_type AS ENUM (
    'donation.created',
    'donation.completed',
    'donation.failed',
    'campaign.created',
    'campaign.completed',
    'user.created',
    'organization.verified'
);