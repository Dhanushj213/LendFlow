-- Add title column to payment_history if it doesn't exist
ALTER TABLE payment_history ADD COLUMN IF NOT EXISTS title TEXT;
