/*
# Fix auth RPC functions — pgcrypto schema path

## Problem
pgcrypto is installed in the `extensions` schema, not `public`.
The functions used `crypt()` and `gen_salt()` without schema qualification,
so they failed with "function gen_salt(unknown, integer) does not exist".

## Fix
- Schema-qualify all pgcrypto calls: `extensions.crypt()` and `extensions.gen_salt()`.
- The function's `SET search_path = public` only covers public, not extensions.
*/

CREATE OR REPLACE FUNCTION register_user(p_email text, p_password text, p_name text)
RETURNS TABLE(id uuid, email text, name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash text;
  v_ret_id uuid;
  v_ret_email text;
  v_ret_name text;
  v_lower_email text;
BEGIN
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

  IF EXISTS (SELECT 1 FROM users WHERE users.email = v_lower_email) THEN
    RAISE EXCEPTION 'Este correo electronico ya esta registrado';
  END IF;

  v_hash := crypt(p_password, gen_salt('bf', 10));

  INSERT INTO users (email, password_hash, name)
  VALUES (v_lower_email, v_hash, p_name)
  RETURNING users.id, users.email, users.name INTO v_ret_id, v_ret_email, v_ret_name;

  RETURN QUERY SELECT v_ret_id, v_ret_email, v_ret_name;
END;
$$;

CREATE OR REPLACE FUNCTION login_user(p_email text, p_password text)
RETURNS TABLE(id uuid, email text, name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash text;
  v_user_id uuid;
  v_user_name text;
  v_lower_email text;
BEGIN
  IF p_email IS NULL OR p_password IS NULL THEN
    RETURN;
  END IF;

  v_lower_email := lower(trim(p_email));

  SELECT users.id, users.password_hash, users.name
  INTO v_user_id, v_hash, v_user_name
  FROM users WHERE users.email = v_lower_email LIMIT 1;

  IF v_user_id IS NULL OR v_hash IS NULL THEN
    RETURN;
  END IF;

  IF v_hash = crypt(p_password, v_hash) THEN
    RETURN QUERY SELECT v_user_id, v_lower_email, v_user_name;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION register_user(text, text, text) FROM public;
REVOKE ALL ON FUNCTION login_user(text, text) FROM public;
GRANT EXECUTE ON FUNCTION register_user(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION login_user(text, text) TO anon, authenticated;