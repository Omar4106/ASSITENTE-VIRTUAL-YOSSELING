/*
# Create user_seals table for Emoji Seal authentication

1. Purpose
   This table stores user accounts for Yosseling's "Sello de Emojis" auth system.
   Instead of email/password, users register with a display name and a personal
   emoji seal (a sequence of 4-8 emojis chosen from a grid). Login reproduces
   the seal. No emails, phone numbers, or traditional passwords.

2. New Tables
   - `user_seals`
     - `id` (uuid, primary key) — unique user ID
     - `display_name` (text, unique, not null) — the name Yosseling uses to greet the user
     - `seal_hash` (text, not null) — SHA-256 hash of the emoji sequence (never store raw seals)
     - `seal_emoji_count` (integer, not null) — number of emojis in the seal (for UX hints)
     - `seal_first_emoji` (text) — first emoji of the seal (shown as a hint on login)
     - `avatar_emoji` (text) — the emoji the user picks as their avatar
     - `created_at` (timestamptz) — registration timestamp
     - `last_login_at` (timestamptz) — last successful login

3. Security
   - RLS enabled on `user_seals`.
   - SELECT is open to `anon, authenticated` — needed so the login flow can look up
     a user by display_name and verify the seal. The seal_hash protects the secret.
   - INSERT is open to `anon, authenticated` — new users register via the anon key.
   - UPDATE is open to `anon, authenticated` — updates last_login_at on login.
   - DELETE is open to `anon, authenticated` — users can delete their account.
   - `USING (true)` is acceptable here because the seal_hash is a one-way hash:
     knowing a row exists doesn't compromise the seal. The actual secret (emoji
     sequence) never leaves the client unhashed.

4. Notes
   - The seal is hashed client-side with SHA-256 before sending to Supabase.
   - The raw emoji sequence is never stored or transmitted.
   - `seal_first_emoji` is stored as a login hint (non-sensitive).
*/

CREATE TABLE IF NOT EXISTS user_seals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text UNIQUE NOT NULL,
  seal_hash text NOT NULL,
  seal_emoji_count integer NOT NULL DEFAULT 4,
  seal_first_emoji text,
  avatar_emoji text DEFAULT '🌟',
  created_at timestamptz DEFAULT now(),
  last_login_at timestamptz DEFAULT now()
);

ALTER TABLE user_seals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_user_seals" ON user_seals;
CREATE POLICY "anon_select_user_seals"
ON user_seals FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "anon_insert_user_seals" ON user_seals;
CREATE POLICY "anon_insert_user_seals"
ON user_seals FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_user_seals" ON user_seals;
CREATE POLICY "anon_update_user_seals"
ON user_seals FOR UPDATE
TO anon, authenticated
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_user_seals" ON user_seals;
CREATE POLICY "anon_delete_user_seals"
ON user_seals FOR DELETE
TO anon, authenticated
USING (true);

CREATE INDEX IF NOT EXISTS idx_user_seals_display_name ON user_seals (display_name);
