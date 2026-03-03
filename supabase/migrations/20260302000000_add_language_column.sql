ALTER TABLE generations
  ADD COLUMN language TEXT NOT NULL DEFAULT 'en'
    CHECK (language IN ('en','es','fr','de','it','pt','ja','zh','ar','ru'));
