-- Remove the UNIQUE constraint on display_name — two users can share a name
ALTER TABLE public.user_seals DROP CONSTRAINT IF EXISTS user_seals_display_name_key;

-- Add a default for seal_hash so inserts don't fail on missing value
ALTER TABLE public.user_seals ALTER COLUMN seal_hash SET DEFAULT '';

-- Add default for seal_first_emoji to NULL explicitly (already nullable, but be safe)
ALTER TABLE public.user_seals ALTER COLUMN seal_first_emoji DROP NOT NULL;

-- Add an index on user_id for faster lookups (already unique, but make explicit)
-- The unique constraint already creates an index, so skip.

-- Ensure last_login_at has a default
ALTER TABLE public.user_seals ALTER COLUMN last_login_at SET DEFAULT now();
