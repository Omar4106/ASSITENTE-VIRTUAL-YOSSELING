'use client';

import { createClient } from '@supabase/supabase-js';

// These are public values — the anon key is designed to be exposed to the
// client. RLS policies protect the actual data. We hardcode them as fallback
// so the app works on Vercel without manual env var configuration.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  'https://nyvpcwzdycvozikwijmn.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55dnBjd3pkeWN2b3ppa3dpam1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNTU0NDQsImV4cCI6MjEwMDkzMTQ0NH0.CzDHLLtYUDInFR0K2Q5YZXKB3aUqwDeXc1H8ZVc9LUk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
