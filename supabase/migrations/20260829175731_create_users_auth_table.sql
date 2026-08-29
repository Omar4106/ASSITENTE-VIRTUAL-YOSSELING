/*
# Create users table for custom JWT authentication

1. New Tables
- `users`
  - `id` (uuid, primary key, auto-generated)
  - `email` (text, unique, not null) — user's email address
  - `password_hash` (text, not null) — bcrypt-hashed password (NEVER stored in plaintext)
  - `name` (text, not null) — display name
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

2. Security
- Enable RLS on `users`.
- SELECT policy: authenticated users can read their own row (id = auth.uid()).
- INSERT policy: none — registration is handled via the service role key in API routes.
- UPDATE policy: authenticated users can update their own row.
- DELETE policy: authenticated users can delete their own row.

3. Important Notes
- This table is for a custom JWT-based auth system (bcrypt + jsonwebtoken).
- Passwords are hashed with bcryptjs on the server before storage.
- The `password_hash` column is NEVER exposed to the client.
- Registration and login use the Supabase service role key (server-side only).
- The anon key client cannot directly insert into this table (no INSERT policy for anon).
- JWT tokens are stored in HttpOnly cookies, not localStorage.

4. Indexes
- Unique index on `email` for fast lookups during login.
*/

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own data
DROP POLICY IF EXISTS "Users can read own data" ON users;
CREATE POLICY "Users can read own data"
ON users FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Allow authenticated users to update their own data
DROP POLICY IF EXISTS "Users can update own data" ON users;
CREATE POLICY "Users can update own data"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow authenticated users to delete their own account
DROP POLICY IF EXISTS "Users can delete own data" ON users;
CREATE POLICY "Users can delete own data"
ON users FOR DELETE
TO authenticated
USING (auth.uid() = id);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();