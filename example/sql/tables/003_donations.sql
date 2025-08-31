-- Donations table - individual donation transactions

CREATE TABLE app.donations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES app.campaigns(id),
    donor_id UUID REFERENCES auth.users(id),
    
    -- Donation details
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    currency_code CHAR(3) DEFAULT 'USD',
    status app.donation_status DEFAULT 'pending',
    
    -- Donor information (for anonymous or guest donations)
    donor_email TEXT,
    donor_name TEXT,
    is_anonymous BOOLEAN DEFAULT false,
    message TEXT,
    
    -- Payment information
    payment_method billing.payment_method,
    payment_intent_id TEXT, -- Stripe/payment processor ID
    transaction_id TEXT UNIQUE,
    
    -- Fee breakdown
    gross_amount DECIMAL(12,2),
    platform_fee DECIMAL(12,2) DEFAULT 0,
    payment_processor_fee DECIMAL(12,2) DEFAULT 0,
    net_amount DECIMAL(12,2),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    
    CONSTRAINT valid_email CHECK (
        donor_email IS NULL OR 
        donor_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    )
);

-- Indexes
CREATE INDEX idx_donations_campaign ON app.donations(campaign_id);
CREATE INDEX idx_donations_donor ON app.donations(donor_id) WHERE donor_id IS NOT NULL;
CREATE INDEX idx_donations_status ON app.donations(status);
CREATE INDEX idx_donations_created ON app.donations(created_at DESC);
CREATE INDEX idx_donations_transaction ON app.donations(transaction_id) WHERE transaction_id IS NOT NULL;

-- Partial index for pending donations that need processing
CREATE INDEX idx_donations_pending ON app.donations(created_at) 
    WHERE status = 'pending';

-- Enable RLS
ALTER TABLE app.donations ENABLE ROW LEVEL SECURITY;