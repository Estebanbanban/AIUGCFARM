-- 004: Personas table
CREATE TYPE persona_gender AS ENUM ('male', 'female', 'non_binary');
CREATE TYPE persona_age_range AS ENUM ('18_25', '25_35', '35_45', '45_55', '55_plus');
CREATE TYPE persona_body_type AS ENUM ('slim', 'average', 'athletic', 'curvy', 'plus_size');

CREATE TABLE IF NOT EXISTS personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  gender persona_gender NOT NULL,
  age_range persona_age_range NOT NULL,
  skin_tone TEXT NOT NULL,
  hair_color TEXT NOT NULL,
  hair_style TEXT NOT NULL,
  eye_color TEXT NOT NULL,
  body_type persona_body_type NOT NULL,
  clothing_style TEXT NOT NULL,
  accessories TEXT[],
  selected_image_url TEXT,
  generated_image_urls TEXT[],
  kling_element_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_personas_user_id ON personas(user_id);
CREATE INDEX idx_personas_brand_id ON personas(brand_id);
