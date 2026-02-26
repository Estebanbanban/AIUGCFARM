-- 003: Products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  primary_image_url TEXT,
  additional_image_urls TEXT[],
  category TEXT,
  tags TEXT[],
  source_url TEXT,
  is_confirmed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_products_brand_id ON products(brand_id);
CREATE INDEX idx_products_user_id ON products(user_id);
