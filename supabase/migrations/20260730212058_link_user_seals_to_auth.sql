/*
# Link user_seals to Supabase Auth and tighten RLS

## Purpose
Migrate the "Emoji Seal" profile table from a standalone, anon-open table
to a proper Supabase Auth-backed profile table. This makes the auth system
production-ready: passwords are hashed by Supabase Auth (bcrypt), sessions
are managed via HttpOnly cookies, and row-level security is enforced per
authenticated user.

## Changes

### 1. New column
- `user_seals.user_id` (uuid, NOT NULL, UNIQUE) — foreign key to
  `auth.users(id)` with `ON DELETE CASCADE`. This links each seal profile
  to exactly one Supabase Auth account.

### 2. Data backfill
- Any existing rows get `user_id = gen_random_uuid()` as a placeholder
  (there are currently 0 rows, so this is a no-op safety measure). In a
  real migration with existing data you would map old rows to new auth
  accounts manually; here the table is empty.

### 3. Index
- `idx_user_seals_user_id` on `user_seals(user_id)` for fast lookups by
  the authenticated session.

### 4. RLS policy changes
- DROP the four old `anon_*` policies (they allowed anon CRUD, which is
  no longer appropriate now that auth is required).
- CREATE four new owner-scoped policies (`TO authenticated`) using
  `auth.uid() = user_id`:
  - `select_own_seal`   (SELECT)
  - `insert_own_seal`   (INSERT, WITH CHECK)
  - `update_own_seal`   (UPDATE, USING + WITH CHECK)
  - `delete_own_seal`   (DELETE, USING)

### 5. Notes
- `user_id` gets `DEFAULT auth.uid()` so frontend inserts that omit
  `user_id` still satisfy the INSERT WITH CHECK policy.
- `display_name` remains UNIQUE — enforced at the DB level.
- `seal_hash` is kept for backward compatibility but is no longer the
  primary auth mechanism; Supabase Auth (bcrypt) handles password security.
*/

-- 1. Add user_id column linked to auth.users
ALTER TABLE user_seals
  ADD COLUMN IF NOT EXISTS user_id uuid
  DEFAULT auth.uid();

-- Backfill any existing rows (no-op on empty table)
UPDATE user_seals
  SET user_id = gen_random_uuid()
  WHERE user_id IS NULL;

ALTER TABLE user_seals
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE user_seals
  ADD CONSTRAINT user_seals_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Unique constraint on user_id (one profile per auth account)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_seals_user_id_key'
  ) THEN
    ALTER TABLE user_seals ADD CONSTRAINT user_seals_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- 3. Index for fast lookups by user_id
CREATE INDEX IF NOT EXISTS idx_user_seals_user_id ON user_seals (user_id);

-- 4. Drop old anon-open policies
DROP POLICY IF EXISTS "anon_select_user_seals" ON user_seals;
DROP POLICY IF EXISTS "anon_insert_user_seals" ON user_seals;
DROP POLICY IF EXISTS "anon_update_user_seals" ON user_seals;
DROP POLICY IF EXISTS "anon_delete_user_seals" ON user_seals;

-- 5. Create new owner-scoped policies (authenticated only)
DROP POLICY IF EXISTS "select_own_seal" ON user_seals;
CREATE POLICY "select_own_seal"
  ON user_seals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_seal" ON user_seals;
CREATE POLICY "insert_own_seal"
  ON user_seals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_seal" ON user_seals;
CREATE POLICY "update_own_seal"
  ON user_seals FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_seal" ON user_seals;
CREATE POLICY "delete_own_seal"
  ON user_seals FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
