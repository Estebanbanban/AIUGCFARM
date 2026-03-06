-- Track how many times a user has changed a persona's selected image.
-- Used to enforce per-plan image re-selection limits:
--   free    → 0 changes allowed (initial pick only)
--   starter → 5 changes per persona
--   growth  → unlimited
--   scale   → unlimited

ALTER TABLE public.personas
  ADD COLUMN IF NOT EXISTS image_selection_count INTEGER NOT NULL DEFAULT 0;
