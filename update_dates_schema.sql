
-- Add end_date to emis
ALTER TABLE emis ADD COLUMN IF NOT EXISTS end_date DATE;

-- Add maturity_date to insurance_policies
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS maturity_date DATE;
