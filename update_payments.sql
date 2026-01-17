CREATE TABLE IF NOT EXISTS payment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    amount DECIMAL NOT NULL,
    payment_date DATE NOT NULL,
    payment_mode TEXT NOT NULL, -- 'UPI', 'CASH', 'BANK_TRANSFER', 'AUTO_DEBIT'
    category TEXT NOT NULL, -- 'EMI', 'INSURANCE', 'REMINDER'
    reference_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add graceful handling columns if they don't exist
ALTER TABLE emis ADD COLUMN IF NOT EXISTS grace_period_days INTEGER DEFAULT 0;
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS grace_period_days INTEGER DEFAULT 0;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS grace_period_days INTEGER DEFAULT 0;
