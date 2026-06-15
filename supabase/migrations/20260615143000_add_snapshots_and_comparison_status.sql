CREATE TABLE IF NOT EXISTS public.ranking_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ranking_key text NOT NULL,
  scope_type text NOT NULL,
  scope_id text NOT NULL,
  ranking_mode text,
  name text NOT NULL,
  notes text,
  song_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ranking_snapshots_song_ids_array CHECK (jsonb_typeof(song_ids_json) = 'array')
);

CREATE INDEX IF NOT EXISTS ranking_snapshots_profile_key_created_idx
  ON public.ranking_snapshots (profile_id, ranking_key, created_at);

CREATE TABLE IF NOT EXISTS public.comparison_status (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status_key text NOT NULL,
  scope_type text NOT NULL,
  scope_id text NOT NULL,
  ranking_mode text,
  completed_at timestamptz NOT NULL,
  completed_comparisons integer,
  song_count integer,
  algorithm_type text,
  algorithm_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, status_key)
);

CREATE INDEX IF NOT EXISTS comparison_status_profile_key_idx
  ON public.comparison_status (profile_id, status_key);

DROP TRIGGER IF EXISTS ranking_snapshots_touch_updated_at ON public.ranking_snapshots;
CREATE TRIGGER ranking_snapshots_touch_updated_at
BEFORE UPDATE ON public.ranking_snapshots
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS comparison_status_touch_updated_at ON public.comparison_status;
CREATE TRIGGER comparison_status_touch_updated_at
BEFORE UPDATE ON public.comparison_status
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.ranking_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comparison_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct ranking snapshot access" ON public.ranking_snapshots;
CREATE POLICY "No direct ranking snapshot access"
ON public.ranking_snapshots
AS PERMISSIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "No direct comparison status access" ON public.comparison_status;
CREATE POLICY "No direct comparison status access"
ON public.comparison_status
AS PERMISSIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

DROP FUNCTION IF EXISTS public.get_ranking_snapshots(uuid, text);
DROP FUNCTION IF EXISTS public.create_ranking_snapshot(uuid, jsonb);
DROP FUNCTION IF EXISTS public.delete_ranking_snapshot(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_comparison_status(uuid, text);
DROP FUNCTION IF EXISTS public.save_comparison_status(uuid, jsonb);

CREATE OR REPLACE FUNCTION public.get_ranking_snapshots(
  p_profile_id uuid,
  p_ranking_key text
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', id::text,
        'key', ranking_key,
        'scopeType', scope_type,
        'scopeId', scope_id,
        'rankingMode', ranking_mode,
        'name', name,
        'notes', notes,
        'songIds', song_ids_json,
        'createdAt', created_at::text,
        'updatedAt', updated_at::text
      )
      ORDER BY created_at ASC
    ),
    '[]'::jsonb
  )
  FROM public.ranking_snapshots
  WHERE profile_id = p_profile_id
    AND ranking_key = p_ranking_key;
$$;

CREATE OR REPLACE FUNCTION public.create_ranking_snapshot(
  p_profile_id uuid,
  p_snapshot jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  saved public.ranking_snapshots%ROWTYPE;
BEGIN
  INSERT INTO public.ranking_snapshots (
    id,
    profile_id,
    ranking_key,
    scope_type,
    scope_id,
    ranking_mode,
    name,
    notes,
    song_ids_json,
    created_at
  )
  VALUES (
    COALESCE((p_snapshot->>'id')::uuid, gen_random_uuid()),
    p_profile_id,
    p_snapshot->>'key',
    p_snapshot->>'scopeType',
    p_snapshot->>'scopeId',
    NULLIF(p_snapshot->>'rankingMode', ''),
    p_snapshot->>'name',
    NULLIF(p_snapshot->>'notes', ''),
    COALESCE(p_snapshot->'songIds', '[]'::jsonb),
    COALESCE((p_snapshot->>'createdAt')::timestamptz, now())
  )
  RETURNING * INTO saved;

  RETURN jsonb_build_object(
    'id', saved.id::text,
    'key', saved.ranking_key,
    'scopeType', saved.scope_type,
    'scopeId', saved.scope_id,
    'rankingMode', saved.ranking_mode,
    'name', saved.name,
    'notes', saved.notes,
    'songIds', saved.song_ids_json,
    'createdAt', saved.created_at::text,
    'updatedAt', saved.updated_at::text
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_ranking_snapshot(
  p_profile_id uuid,
  p_snapshot_id uuid
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.ranking_snapshots
  WHERE profile_id = p_profile_id
    AND id = p_snapshot_id;
$$;

CREATE OR REPLACE FUNCTION public.get_comparison_status(
  p_profile_id uuid,
  p_status_key text
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'key', status_key,
    'scopeType', scope_type,
    'scopeId', scope_id,
    'rankingMode', ranking_mode,
    'completedAt', completed_at::text,
    'completedComparisons', completed_comparisons,
    'songCount', song_count,
    'algorithmType', algorithm_type,
    'algorithmVersion', algorithm_version,
    'createdAt', created_at::text,
    'updatedAt', updated_at::text
  )
  FROM public.comparison_status
  WHERE profile_id = p_profile_id
    AND status_key = p_status_key;
$$;

CREATE OR REPLACE FUNCTION public.save_comparison_status(
  p_profile_id uuid,
  p_status jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  saved public.comparison_status%ROWTYPE;
BEGIN
  INSERT INTO public.comparison_status (
    profile_id,
    status_key,
    scope_type,
    scope_id,
    ranking_mode,
    completed_at,
    completed_comparisons,
    song_count,
    algorithm_type,
    algorithm_version
  )
  VALUES (
    p_profile_id,
    p_status->>'key',
    p_status->>'scopeType',
    p_status->>'scopeId',
    NULLIF(p_status->>'rankingMode', ''),
    (p_status->>'completedAt')::timestamptz,
    NULLIF(p_status->>'completedComparisons', '')::integer,
    NULLIF(p_status->>'songCount', '')::integer,
    NULLIF(p_status->>'algorithmType', ''),
    NULLIF(p_status->>'algorithmVersion', '')
  )
  ON CONFLICT (profile_id, status_key) DO UPDATE SET
    scope_type = excluded.scope_type,
    scope_id = excluded.scope_id,
    ranking_mode = excluded.ranking_mode,
    completed_at = excluded.completed_at,
    completed_comparisons = excluded.completed_comparisons,
    song_count = excluded.song_count,
    algorithm_type = excluded.algorithm_type,
    algorithm_version = excluded.algorithm_version
  RETURNING * INTO saved;

  RETURN jsonb_build_object(
    'key', saved.status_key,
    'scopeType', saved.scope_type,
    'scopeId', saved.scope_id,
    'rankingMode', saved.ranking_mode,
    'completedAt', saved.completed_at::text,
    'completedComparisons', saved.completed_comparisons,
    'songCount', saved.song_count,
    'algorithmType', saved.algorithm_type,
    'algorithmVersion', saved.algorithm_version,
    'createdAt', saved.created_at::text,
    'updatedAt', saved.updated_at::text
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ranking_snapshots(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_ranking_snapshot(uuid, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_ranking_snapshot(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_comparison_status(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_comparison_status(uuid, jsonb) TO anon, authenticated;

SELECT pg_notify('pgrst', 'reload schema');
