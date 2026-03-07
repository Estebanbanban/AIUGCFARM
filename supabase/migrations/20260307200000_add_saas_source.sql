-- Allow 'saas' as a valid product source.
-- Additive-only: no existing rows are touched.
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_source_check;
ALTER TABLE products ADD CONSTRAINT products_source_check
  CHECK (source IN ('shopify', 'generic', 'manual', 'saas'));
