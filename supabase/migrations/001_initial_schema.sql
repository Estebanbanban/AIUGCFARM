-- ============================================================
-- 001_initial_schema.sql
-- Complete database schema for UGC Farm AI (BMAD architecture)
-- ============================================================

-- =========================
-- Extensions
-- =========================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================
-- Helper trigger function
-- =========================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================
-- Tables
-- =========================

-- profiles (extends auth.users via trigger)
CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  full_name  TEXT,
  avatar_url TEXT,
  plan       TEXT NOT NULL DEFAULT 'free'
               CHECK (plan IN ('free','starter','growth','scale')),
  role       TEXT NOT NULL DEFAULT 'user'
               CHECK (role IN ('user','admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- subscriptions
CREATE TABLE subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_customer_id      TEXT NOT NULL,
  stripe_subscription_id  TEXT UNIQUE,
  plan                    TEXT CHECK (plan IN ('starter','growth','scale')),
  status                  TEXT CHECK (status IN ('active','past_due','canceled','incomplete')),
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- credit_balances
CREATE TABLE credit_balances (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id  UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  remaining INTEGER NOT NULL DEFAULT 0 CHECK (remaining >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- credit_ledger
CREATE TABLE credit_ledger (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount       INTEGER NOT NULL,
  reason       TEXT NOT NULL
                 CHECK (reason IN ('subscription_renewal','generation','refund','bonus','free_trial')),
  reference_id UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- products
CREATE TABLE products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  store_url     TEXT,
  name          TEXT NOT NULL,
  description   TEXT,
  price         DECIMAL(10,2),
  currency      TEXT DEFAULT 'USD',
  category      TEXT,
  images        JSONB NOT NULL DEFAULT '[]',
  brand_summary JSONB,
  source        TEXT NOT NULL CHECK (source IN ('shopify','generic','manual')),
  confirmed     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- personas
CREATE TABLE personas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  attributes          JSONB NOT NULL,
  selected_image_url  TEXT,
  generated_images    JSONB DEFAULT '[]',
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- generations (replaces segment_batches, segments, video_combos)
CREATE TABLE generations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id        UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  persona_id        UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  mode              TEXT NOT NULL DEFAULT 'easy'
                      CHECK (mode IN ('easy','expert')),
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','scripting','generating_image','submitting_jobs','generating_segments','generating_video','stitching','completed','failed')),
  script            JSONB,
  composite_image_url TEXT,
  videos            JSONB DEFAULT '[]',
  error_message     TEXT,
  external_job_ids  JSONB DEFAULT '{}',
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- audit_logs
CREATE TABLE audit_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  event_id   TEXT UNIQUE,
  metadata   JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- Indexes
-- =========================
CREATE INDEX idx_products_owner             ON products(owner_id);
CREATE INDEX idx_personas_owner             ON personas(owner_id);
CREATE INDEX idx_generations_owner          ON generations(owner_id);
CREATE INDEX idx_generations_status         ON generations(status);
CREATE INDEX idx_credit_ledger_owner        ON credit_ledger(owner_id);
CREATE INDEX idx_audit_logs_event_id        ON audit_logs(event_id);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);

-- =========================
-- Updated-at triggers
-- =========================
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_personas_updated_at
  BEFORE UPDATE ON personas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_credit_balances_updated_at
  BEFORE UPDATE ON credit_balances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =========================
-- New-user trigger
-- =========================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile
  INSERT INTO profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', '')
  );

  -- Seed 9 free segment credits (1 full batch = 27 video combinations)
  INSERT INTO credit_balances (owner_id, remaining)
  VALUES (NEW.id, 9);

  INSERT INTO credit_ledger (owner_id, amount, reason)
  VALUES (NEW.id, 9, 'free_trial');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =========================
-- Row Level Security
-- =========================

-- profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own products"
  ON products FOR ALL
  USING (auth.uid() = owner_id);

-- personas
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own personas"
  ON personas FOR ALL
  USING (auth.uid() = owner_id);

-- generations
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own generations"
  ON generations FOR SELECT
  USING (auth.uid() = owner_id);

-- credit_balances
ALTER TABLE credit_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit balance"
  ON credit_balances FOR SELECT
  USING (auth.uid() = owner_id);

-- credit_ledger
ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit ledger"
  ON credit_ledger FOR SELECT
  USING (auth.uid() = owner_id);

-- subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = owner_id);

-- audit_logs (service_role only  -  no user policies)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
