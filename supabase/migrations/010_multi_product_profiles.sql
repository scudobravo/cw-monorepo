-- Allow a single user to have access to multiple products (DevOracle + RingWise)
-- The `product` column stays as the "primary" product (first signup).
-- `products` array tracks all products the user has access to.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS products TEXT[] NOT NULL DEFAULT '{}';

-- Populate existing rows
UPDATE profiles
SET products = ARRAY[product]
WHERE products = '{}';

-- Policy: users can update their own products array (needed for cross-product signups)
-- (existing RLS policies on profiles cover SELECT/INSERT already)
