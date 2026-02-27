-- Production DB was set up with a narrower source constraint that excluded 'generic'.
-- Drop and recreate with the correct allowed values.
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_source_check;
ALTER TABLE products ADD CONSTRAINT products_source_check
  CHECK (source IN ('shopify', 'generic', 'manual'));
