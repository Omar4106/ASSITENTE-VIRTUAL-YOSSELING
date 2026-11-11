CREATE TABLE IF NOT EXISTS public.workspace_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  artifact_id text NOT NULL,
  public_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  artifact_type text NOT NULL CHECK (artifact_type IN ('document', 'web')),
  path text NOT NULL CHECK (char_length(path) BETWEEN 1 AND 500),
  content text NOT NULL CHECK (octet_length(content) <= 1000000),
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, artifact_id)
);

CREATE INDEX IF NOT EXISTS workspace_projects_public_id_idx
  ON public.workspace_projects (public_id)
  WHERE is_public;

ALTER TABLE public.workspace_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public projects can be viewed through their share link" ON public.workspace_projects;
CREATE POLICY "Users can view their own workspace projects"
  ON public.workspace_projects FOR SELECT
  USING ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS "Users can create their own workspace projects" ON public.workspace_projects;
CREATE POLICY "Users can create their own workspace projects"
  ON public.workspace_projects FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS "Users can update their own workspace projects" ON public.workspace_projects;
CREATE POLICY "Users can update their own workspace projects"
  ON public.workspace_projects FOR UPDATE TO authenticated
  USING ((select auth.uid()) = owner_id)
  WITH CHECK ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS "Users can delete their own workspace projects" ON public.workspace_projects;
CREATE POLICY "Users can delete their own workspace projects"
  ON public.workspace_projects FOR DELETE TO authenticated
  USING ((select auth.uid()) = owner_id);

REVOKE ALL ON public.workspace_projects FROM anon;
GRANT SELECT ON public.workspace_projects TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.workspace_projects TO authenticated;

CREATE TABLE IF NOT EXISTS public.workspace_collaborations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES public.workspace_projects(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  document_state text NOT NULL CHECK (octet_length(document_state) <= 2000000),
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_collaboration_members (
  collaboration_id uuid NOT NULL REFERENCES public.workspace_collaborations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'editor')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collaboration_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.workspace_collaboration_updates (
  collaboration_id uuid NOT NULL REFERENCES public.workspace_collaborations(id) ON DELETE CASCADE,
  update_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  update_data text NOT NULL CHECK (octet_length(update_data) <= 1000000),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collaboration_id, update_id)
);

ALTER TABLE public.workspace_collaborations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_collaboration_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_collaboration_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project owners and collaborators can view collaboration metadata" ON public.workspace_collaborations;
CREATE POLICY "Project owners and collaborators can view collaboration metadata"
  ON public.workspace_collaborations FOR SELECT TO authenticated
  USING (
    owner_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.workspace_collaboration_members member
      WHERE member.collaboration_id = id AND member.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owners can create collaboration metadata" ON public.workspace_collaborations;
CREATE POLICY "Owners can create collaboration metadata"
  ON public.workspace_collaborations FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.workspace_projects project
      WHERE project.id = project_id AND project.owner_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Project owners and collaborators can view the shared project" ON public.workspace_projects;
CREATE POLICY "Project owners and collaborators can view the shared project"
  ON public.workspace_projects FOR SELECT TO authenticated
  USING (
    owner_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.workspace_collaborations collaboration
      JOIN public.workspace_collaboration_members member
        ON member.collaboration_id = collaboration.id
      WHERE collaboration.project_id = workspace_projects.id
        AND collaboration.is_enabled
        AND member.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Collaborators can view workspace membership" ON public.workspace_collaboration_members;
CREATE POLICY "Collaborators can view workspace membership"
  ON public.workspace_collaboration_members FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.workspace_collaborations collaboration
      WHERE collaboration.id = workspace_collaboration_members.collaboration_id
        AND collaboration.owner_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owners can add themselves to collaboration" ON public.workspace_collaboration_members;
CREATE POLICY "Owners can add themselves to collaboration"
  ON public.workspace_collaboration_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND role = 'owner'
    AND EXISTS (
      SELECT 1 FROM public.workspace_collaborations collaboration
      WHERE collaboration.id = collaboration_id AND collaboration.owner_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Collaborators can read project updates" ON public.workspace_collaboration_updates;
CREATE POLICY "Collaborators can read project updates"
  ON public.workspace_collaboration_updates FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_collaboration_members member
      JOIN public.workspace_collaborations collaboration
        ON collaboration.id = member.collaboration_id
      WHERE member.collaboration_id = workspace_collaboration_updates.collaboration_id
        AND member.user_id = (select auth.uid())
        AND collaboration.is_enabled
    )
  );

DROP POLICY IF EXISTS "Collaborators can append project updates" ON public.workspace_collaboration_updates;
CREATE POLICY "Collaborators can append project updates"
  ON public.workspace_collaboration_updates FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.workspace_collaboration_members member
      JOIN public.workspace_collaborations collaboration
        ON collaboration.id = member.collaboration_id
      WHERE member.collaboration_id = workspace_collaboration_updates.collaboration_id
        AND member.user_id = (select auth.uid())
        AND collaboration.is_enabled
    )
  );

GRANT SELECT ON public.workspace_collaborations, public.workspace_collaboration_members, public.workspace_collaboration_updates TO authenticated;
GRANT INSERT ON public.workspace_collaborations, public.workspace_collaboration_members, public.workspace_collaboration_updates TO authenticated;

CREATE OR REPLACE FUNCTION public.join_workspace_collaboration(p_invite_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_collaboration_id uuid;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT collaboration.id
    INTO v_collaboration_id
    FROM public.workspace_collaborations collaboration
    WHERE collaboration.invite_id = p_invite_id
      AND collaboration.is_enabled;

  IF v_collaboration_id IS NULL THEN
    RAISE EXCEPTION 'Invitation not found or disabled';
  END IF;

  INSERT INTO public.workspace_collaboration_members (collaboration_id, user_id, role)
    VALUES (v_collaboration_id, v_user_id, 'editor')
    ON CONFLICT (collaboration_id, user_id) DO NOTHING;

  RETURN v_collaboration_id;
END;
$$;

REVOKE ALL ON FUNCTION public.join_workspace_collaboration(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_workspace_collaboration(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_public_workspace_project(p_public_id uuid)
RETURNS TABLE (
  name text,
  artifact_type text,
  path text,
  content text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT project.name, project.artifact_type, project.path, project.content
  FROM public.workspace_projects project
  WHERE project.public_id = p_public_id
    AND project.is_public;
$$;

REVOKE ALL ON FUNCTION public.get_public_workspace_project(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_workspace_project(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Members can receive collaboration broadcasts" ON realtime.messages;
CREATE POLICY "Members can receive collaboration broadcasts"
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_collaborations collaboration
      JOIN public.workspace_collaboration_members member
        ON member.collaboration_id = collaboration.id
      WHERE collaboration.id::text = split_part((select realtime.topic()), ':', 2)
        AND collaboration.is_enabled
        AND member.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Members can send collaboration broadcasts" ON realtime.messages;
CREATE POLICY "Members can send collaboration broadcasts"
  ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.workspace_collaborations collaboration
      JOIN public.workspace_collaboration_members member
        ON member.collaboration_id = collaboration.id
      WHERE collaboration.id::text = split_part((select realtime.topic()), ':', 2)
        AND collaboration.is_enabled
        AND member.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Members can read collaboration presence" ON realtime.messages;
CREATE POLICY "Members can read collaboration presence"
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    realtime.messages.extension = 'presence'
    AND EXISTS (
      SELECT 1
      FROM public.workspace_collaborations collaboration
      JOIN public.workspace_collaboration_members member
        ON member.collaboration_id = collaboration.id
      WHERE collaboration.id::text = split_part((select realtime.topic()), ':', 2)
        AND collaboration.is_enabled
        AND member.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Members can publish collaboration presence" ON realtime.messages;
CREATE POLICY "Members can publish collaboration presence"
  ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (
    realtime.messages.extension = 'presence'
    AND EXISTS (
      SELECT 1
      FROM public.workspace_collaborations collaboration
      JOIN public.workspace_collaboration_members member
        ON member.collaboration_id = collaboration.id
      WHERE collaboration.id::text = split_part((select realtime.topic()), ':', 2)
        AND collaboration.is_enabled
        AND member.user_id = (select auth.uid())
    )
  );
