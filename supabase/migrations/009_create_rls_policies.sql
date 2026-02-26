-- 009: Row Level Security policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE segment_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's internal ID from clerk_id stored in JWT
CREATE OR REPLACE FUNCTION requesting_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT id FROM users WHERE clerk_id = auth.jwt() ->> 'sub'
$$;

-- Users: can read/update own row
CREATE POLICY "users_select_own" ON users FOR SELECT USING (id = requesting_user_id());
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (id = requesting_user_id());

-- Brands: full CRUD on own brands
CREATE POLICY "brands_select_own" ON brands FOR SELECT USING (user_id = requesting_user_id() AND deleted_at IS NULL);
CREATE POLICY "brands_insert_own" ON brands FOR INSERT WITH CHECK (user_id = requesting_user_id());
CREATE POLICY "brands_update_own" ON brands FOR UPDATE USING (user_id = requesting_user_id());
CREATE POLICY "brands_delete_own" ON brands FOR DELETE USING (user_id = requesting_user_id());

-- Products: full CRUD on own products
CREATE POLICY "products_select_own" ON products FOR SELECT USING (user_id = requesting_user_id() AND deleted_at IS NULL);
CREATE POLICY "products_insert_own" ON products FOR INSERT WITH CHECK (user_id = requesting_user_id());
CREATE POLICY "products_update_own" ON products FOR UPDATE USING (user_id = requesting_user_id());
CREATE POLICY "products_delete_own" ON products FOR DELETE USING (user_id = requesting_user_id());

-- Personas: full CRUD on own personas
CREATE POLICY "personas_select_own" ON personas FOR SELECT USING (user_id = requesting_user_id() AND deleted_at IS NULL);
CREATE POLICY "personas_insert_own" ON personas FOR INSERT WITH CHECK (user_id = requesting_user_id());
CREATE POLICY "personas_update_own" ON personas FOR UPDATE USING (user_id = requesting_user_id());
CREATE POLICY "personas_delete_own" ON personas FOR DELETE USING (user_id = requesting_user_id());

-- Segment batches: read own
CREATE POLICY "segment_batches_select_own" ON segment_batches FOR SELECT USING (user_id = requesting_user_id());
CREATE POLICY "segment_batches_insert_own" ON segment_batches FOR INSERT WITH CHECK (user_id = requesting_user_id());

-- Segments: read own
CREATE POLICY "segments_select_own" ON segments FOR SELECT USING (user_id = requesting_user_id());

-- Video combos: CRUD on own
CREATE POLICY "video_combos_select_own" ON video_combos FOR SELECT USING (user_id = requesting_user_id());
CREATE POLICY "video_combos_insert_own" ON video_combos FOR INSERT WITH CHECK (user_id = requesting_user_id());

-- Subscriptions: read own
CREATE POLICY "subscriptions_select_own" ON subscriptions FOR SELECT USING (user_id = requesting_user_id());

-- Credit transactions: read own
CREATE POLICY "credit_transactions_select_own" ON credit_transactions FOR SELECT USING (user_id = requesting_user_id());
