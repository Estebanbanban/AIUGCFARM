-- Add exported_at column to slideshows table to track when a slideshow was exported
ALTER TABLE slideshows ADD COLUMN IF NOT EXISTS exported_at TIMESTAMPTZ;
