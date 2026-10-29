ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nickname text,
  ADD COLUMN IF NOT EXISTS animated_background boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.user_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'general',
  content text NOT NULL,
  importance_score integer NOT NULL DEFAULT 50 CHECK (importance_score BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_memories_unique_content
  ON public.user_memories (user_id, category, content);

ALTER TABLE public.user_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User memories are readable by owner" ON public.user_memories;
CREATE POLICY "User memories are readable by owner"
  ON public.user_memories FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "User memories can be created by owner" ON public.user_memories;
CREATE POLICY "User memories can be created by owner"
  ON public.user_memories FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "User memories can be updated by owner" ON public.user_memories;
CREATE POLICY "User memories can be updated by owner"
  ON public.user_memories FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "User memories can be deleted by owner" ON public.user_memories;
CREATE POLICY "User memories can be deleted by owner"
  ON public.user_memories FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Avatar images are publicly readable" ON storage.objects;
CREATE POLICY "Avatar images are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their avatar" ON storage.objects;
CREATE POLICY "Users can upload their avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS "Users can update their avatar" ON storage.objects;
CREATE POLICY "Users can update their avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS "Users can delete their avatar" ON storage.objects;
CREATE POLICY "Users can delete their avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );
