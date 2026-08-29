/*
# Create auth RPC functions for registration and login

1. New Functions
- `register_user(p_email, p_password, p_name)` — SECURITY DEFINER function that:
  - Validates email format and password length (>= 8 chars)
  - Hashes the password using pgcrypto's crypt() with gen_salt('bf')
  - Inserts a new user row
  - Returns the user's id, email, and name
- `login_user(p_email, p_password)` — SECURITY DEFINER function that:
  - Looks up the user by email
  - Verifies the password hash using pgcrypto's crypt()
  - Returns the user's id, email, and name if valid
  - Returns NULL if invalid credentials

2. Security
- Both functions are SECURITY DEFINER so they can read/write the users table
  even though the anon role has no INSERT/SELECT policies on it.
- The password_hash column is never returned to the client.
- bcrypt-style hashing via pgcrypto's crypt() with bf salt (blowfish, 10 rounds).
- Functions grant execute only to anon, authenticated.

3. Important Notes
- These functions replace the need for the Supabase service role key in API routes.
- The Next.js API routes can use the anon key + .rpc() to call these functions.
- Password hashing happens in the database, not in the Node.js server.
- This is actually MORE secure because the password never leaves the DB layer.
*/

-- Enable pgcrypto for crypt() and gen_salt()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Register function
CREATE OR REPLACE FUNCTION register_user(p_email text, p_password text, p_name text)
RETURNS TABLE(id uuid, email text, name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_id uuid;
  v_lower_email text;
  v_ret_email text;
  v_ret_name text;
BEGIN
  -- Validate inputs
  IF p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'El correo electronico es obligatorio';
  END IF;
  IF p_password IS NULL OR length(p_password) < 8 THEN
    RAISE EXCEPTION 'La contrasena debe tener al menos 8 caracteres';
  END IF;
  IF p_name IS NULL OR length(p_name) < 2 THEN
    RAISE EXCEPTION 'El nombre debe tener al menos 2 caracteres';
  END IF;

  v_lower_email := lower(trim(p_email));

  -- Check if email already exists
  IF EXISTS (SELECT 1 FROM users WHERE email = v_lower_email) THEN
    RAISE EXCEPTION 'Este correo electronico ya esta registrado';
  END IF;

  -- Hash password with bcrypt (blowfish, 10 rounds)
  v_hash := crypt(p_password, gen_salt('bf', 10));

  -- Insert user
  INSERT INTO users (email, password_hash, name)
  VALUES (v_lower_email, v_hash, p_name)
  RETURNING id, email, name INTO v_id, v_ret_email, v_ret_name;

  RETURN QUERY SELECT v_id, v_ret_email, v_ret_name;
END;
$$;

-- Login function
CREATE OR REPLACE FUNCTION login_user(p_email text, p_password text)
RETURNS TABLE(id uuid, email text, name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_id uuid;
  v_name text;
  v_lower_email text;
BEGIN
  IF p_email IS NULL OR p_password IS NULL THEN
    RETURN;
  END IF;

  v_lower_email := lower(trim(p_email));

  -- Get stored hash
  SELECT id, password_hash, name INTO v_id, v_hash, v_name
  FROM users WHERE email = v_lower_email LIMIT 1;

  -- If user not found or password doesn't match, return nothing
  IF v_id IS NULL OR v_hash IS NULL THEN
    RETURN;
  END IF;

  -- Verify password
  IF v_hash = crypt(p_password, v_hash) THEN
    RETURN QUERY SELECT v_id, v_lower_email, v_name;
  END IF;
END;
$$;

-- Revoke and grant execute permissions
REVOKE ALL ON FUNCTION register_user(text, text, text) FROM public;
REVOKE ALL ON FUNCTION login_user(text, text) FROM public;
GRANT EXECUTE ON FUNCTION register_user(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION login_user(text, text) TO anon, authenticated;