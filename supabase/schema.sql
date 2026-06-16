-- Eurovision Ranker Supabase setup
-- Paste this whole file into Supabase SQL Editor and run it.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  name text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_username_format CHECK (username ~ '^[a-zA-Z0-9_-]+$'),
  CONSTRAINT profiles_username_length CHECK (char_length(username) BETWEEN 1 AND 24),
  CONSTRAINT profiles_name_length CHECK (char_length(name) BETWEEN 1 AND 32)
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_idx
  ON public.profiles (lower(username));

CREATE TABLE IF NOT EXISTS public.rankings (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ranking_key text NOT NULL,
  song_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, ranking_key),
  CONSTRAINT rankings_song_ids_array CHECK (jsonb_typeof(song_ids_json) = 'array')
);

CREATE INDEX IF NOT EXISTS rankings_profile_id_idx
  ON public.rankings (profile_id);

CREATE TABLE IF NOT EXISTS public.favorites (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  song_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT favorites_song_ids_array CHECK (jsonb_typeof(song_ids_json) = 'array')
);

CREATE TABLE IF NOT EXISTS public.comparisons (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  comparison_key text NOT NULL,
  state_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, comparison_key),
  CONSTRAINT comparisons_state_object CHECK (jsonb_typeof(state_json) = 'object')
);

CREATE INDEX IF NOT EXISTS comparisons_profile_id_idx
  ON public.comparisons (profile_id);

CREATE TABLE IF NOT EXISTS public.global_rankings (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  state_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT global_rankings_state_object CHECK (jsonb_typeof(state_json) = 'object')
);

CREATE TABLE IF NOT EXISTS public.predictions (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  prediction_key text NOT NULL,
  state_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, prediction_key),
  CONSTRAINT predictions_state_object CHECK (jsonb_typeof(state_json) = 'object')
);

CREATE INDEX IF NOT EXISTS predictions_profile_id_idx
  ON public.predictions (profile_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.ranker_setup_status();
DROP FUNCTION IF EXISTS public.signup_profile(text, text, text);
DROP FUNCTION IF EXISTS public.login_profile(text, text);
DROP FUNCTION IF EXISTS public.get_ranking(uuid, text);
DROP FUNCTION IF EXISTS public.save_ranking(uuid, text, text[]);
DROP FUNCTION IF EXISTS public.clear_ranking(uuid, text);
DROP FUNCTION IF EXISTS public.get_favorites(uuid);
DROP FUNCTION IF EXISTS public.save_favorites(uuid, text[]);
DROP FUNCTION IF EXISTS public.get_comparison(text, uuid);
DROP FUNCTION IF EXISTS public.save_comparison(text, uuid, jsonb);
DROP FUNCTION IF EXISTS public.clear_comparison(text, uuid);
DROP FUNCTION IF EXISTS public.get_global_ranking(uuid);
DROP FUNCTION IF EXISTS public.save_global_ranking(uuid, jsonb);
DROP FUNCTION IF EXISTS public.clear_global_ranking(uuid);
DROP FUNCTION IF EXISTS public.get_prediction(uuid, text);
DROP FUNCTION IF EXISTS public.get_prediction(text, uuid);
DROP FUNCTION IF EXISTS public.save_prediction(uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.save_prediction(text, uuid, jsonb);
DROP FUNCTION IF EXISTS public.clear_prediction(uuid, text);
DROP FUNCTION IF EXISTS public.clear_prediction(text, uuid);

DROP TRIGGER IF EXISTS profiles_touch_updated_at ON public.profiles;
CREATE TRIGGER profiles_touch_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS rankings_touch_updated_at ON public.rankings;
CREATE TRIGGER rankings_touch_updated_at
BEFORE UPDATE ON public.rankings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS favorites_touch_updated_at ON public.favorites;
CREATE TRIGGER favorites_touch_updated_at
BEFORE UPDATE ON public.favorites
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS comparisons_touch_updated_at ON public.comparisons;
CREATE TRIGGER comparisons_touch_updated_at
BEFORE UPDATE ON public.comparisons
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS global_rankings_touch_updated_at ON public.global_rankings;
CREATE TRIGGER global_rankings_touch_updated_at
BEFORE UPDATE ON public.global_rankings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS predictions_touch_updated_at ON public.predictions;
CREATE TRIGGER predictions_touch_updated_at
BEFORE UPDATE ON public.predictions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct profile access" ON public.profiles;
CREATE POLICY "No direct profile access"
ON public.profiles
AS PERMISSIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "No direct ranking access" ON public.rankings;
CREATE POLICY "No direct ranking access"
ON public.rankings
AS PERMISSIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "No direct favorites access" ON public.favorites;
CREATE POLICY "No direct favorites access"
ON public.favorites
AS PERMISSIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "No direct comparison access" ON public.comparisons;
CREATE POLICY "No direct comparison access"
ON public.comparisons
AS PERMISSIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "No direct global ranking access" ON public.global_rankings;
CREATE POLICY "No direct global ranking access"
ON public.global_rankings
AS PERMISSIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "No direct prediction access" ON public.predictions;
CREATE POLICY "No direct prediction access"
ON public.predictions
AS PERMISSIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.validate_ranker_password(p_password text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF length(coalesce(p_password, '')) < 8 OR length(coalesce(p_password, '')) > 20 THEN
    RETURN 'Password must be 8-20 characters.';
  END IF;
  IF p_password !~ '[a-z]' THEN
    RETURN 'Password needs at least one lowercase letter.';
  END IF;
  IF p_password !~ '[A-Z]' THEN
    RETURN 'Password needs at least one capital letter.';
  END IF;
  IF p_password !~ '[0-9]' THEN
    RETURN 'Password needs at least one number.';
  END IF;
  IF p_password !~ '[^A-Za-z0-9]' THEN
    RETURN 'Password needs at least one symbol.';
  END IF;
  RETURN '';
END;
$$;

-- RPC called by the frontend:
-- supabase.rpc("signup_profile", { p_name, p_username, p_password })
-- Supabase/PostgREST may display this as public.signup_profile(p_name, p_password, p_username).
CREATE OR REPLACE FUNCTION public.signup_profile(
  p_name text,
  p_password text,
  p_username text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_name text := trim(coalesce(p_name, ''));
  clean_username text := trim(coalesce(p_username, ''));
  password_error text := public.validate_ranker_password(p_password);
  created_profile public.profiles%ROWTYPE;
BEGIN
  IF clean_name = '' THEN
    RAISE EXCEPTION 'Enter your name.';
  END IF;
  IF clean_username = '' THEN
    RAISE EXCEPTION 'Enter a username.';
  END IF;
  IF length(clean_name) > 32 THEN
    RAISE EXCEPTION 'Name must be 32 characters or fewer.';
  END IF;
  IF length(clean_username) > 24 THEN
    RAISE EXCEPTION 'Username must be 24 characters or fewer.';
  END IF;
  IF clean_username !~ '^[a-zA-Z0-9_-]+$' THEN
    RAISE EXCEPTION 'Username can only use letters, numbers, underscores, and hyphens.';
  END IF;
  IF password_error <> '' THEN
    RAISE EXCEPTION '%', password_error;
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(clean_username)) THEN
    RAISE EXCEPTION 'That profile already exists.';
  END IF;

  INSERT INTO public.profiles (username, name, password_hash)
  VALUES (clean_username, clean_name, extensions.crypt(p_password, extensions.gen_salt('bf')))
  RETURNING * INTO created_profile;

  RETURN jsonb_build_object(
    'id', created_profile.id::text,
    'name', created_profile.name,
    'username', created_profile.username
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.login_profile(
  p_password text,
  p_username text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile public.profiles%ROWTYPE;
BEGIN
  SELECT *
    INTO profile
    FROM public.profiles
    WHERE lower(username) = lower(trim(coalesce(p_username, '')));

  IF profile.id IS NULL THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;
  IF profile.password_hash <> extensions.crypt(p_password, profile.password_hash) THEN
    RAISE EXCEPTION 'Incorrect password.';
  END IF;

  RETURN jsonb_build_object(
    'id', profile.id::text,
    'name', profile.name,
    'username', profile.username
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_ranking(
  p_profile_id uuid,
  p_ranking_key text
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN r.profile_id IS NULL THEN NULL
    ELSE jsonb_build_object(
      'key', r.ranking_key,
      'songIds', r.song_ids_json,
      'updatedAt', r.updated_at::text
    )
  END
  FROM (SELECT 1) seed
  LEFT JOIN public.rankings r
    ON r.profile_id = p_profile_id
   AND r.ranking_key = p_ranking_key;
$$;

CREATE OR REPLACE FUNCTION public.save_ranking(
  p_profile_id uuid,
  p_ranking_key text,
  p_song_ids text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  saved public.rankings%ROWTYPE;
BEGIN
  INSERT INTO public.rankings (profile_id, ranking_key, song_ids_json)
  VALUES (p_profile_id, p_ranking_key, to_jsonb(coalesce(p_song_ids, ARRAY[]::text[])))
  ON CONFLICT (profile_id, ranking_key) DO UPDATE SET
    song_ids_json = excluded.song_ids_json
  RETURNING * INTO saved;

  RETURN jsonb_build_object(
    'key', saved.ranking_key,
    'songIds', saved.song_ids_json,
    'updatedAt', saved.updated_at::text
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_ranking(
  p_profile_id uuid,
  p_ranking_key text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rankings
  WHERE profile_id = p_profile_id
    AND ranking_key = p_ranking_key;
$$;

CREATE OR REPLACE FUNCTION public.get_favorites(p_profile_id uuid)
RETURNS text[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(value), ARRAY[]::text[])
  FROM public.favorites f
  CROSS JOIN LATERAL jsonb_array_elements_text(f.song_ids_json) AS value
  WHERE f.profile_id = p_profile_id;
$$;

CREATE OR REPLACE FUNCTION public.save_favorites(
  p_profile_id uuid,
  p_song_ids text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  saved public.favorites%ROWTYPE;
BEGIN
  INSERT INTO public.favorites (profile_id, song_ids_json)
  VALUES (p_profile_id, to_jsonb(coalesce(p_song_ids, ARRAY[]::text[])))
  ON CONFLICT (profile_id) DO UPDATE SET
    song_ids_json = excluded.song_ids_json
  RETURNING * INTO saved;

  RETURN jsonb_build_object(
    'songIds', saved.song_ids_json,
    'updatedAt', saved.updated_at::text
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_comparison(
  p_comparison_key text,
  p_profile_id uuid
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT state_json
  FROM public.comparisons
  WHERE profile_id = p_profile_id
    AND comparison_key = p_comparison_key;
$$;

CREATE OR REPLACE FUNCTION public.save_comparison(
  p_comparison_key text,
  p_profile_id uuid,
  p_state jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_state jsonb := jsonb_set(
    coalesce(p_state, '{}'::jsonb),
    '{updatedAt}',
    to_jsonb(now()::text),
    true
  );
BEGIN
  INSERT INTO public.comparisons (profile_id, comparison_key, state_json)
  VALUES (p_profile_id, p_comparison_key, updated_state)
  ON CONFLICT (profile_id, comparison_key) DO UPDATE SET
    state_json = excluded.state_json;

  RETURN updated_state;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_comparison(
  p_comparison_key text,
  p_profile_id uuid
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.comparisons
  WHERE profile_id = p_profile_id
    AND comparison_key = p_comparison_key;
$$;

CREATE OR REPLACE FUNCTION public.get_global_ranking(p_profile_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT state_json
  FROM public.global_rankings
  WHERE profile_id = p_profile_id;
$$;

CREATE OR REPLACE FUNCTION public.save_global_ranking(
  p_profile_id uuid,
  p_state jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_state jsonb := jsonb_set(
    coalesce(p_state, '{}'::jsonb),
    '{updatedAt}',
    to_jsonb(now()::text),
    true
  );
BEGIN
  INSERT INTO public.global_rankings (profile_id, state_json)
  VALUES (p_profile_id, updated_state)
  ON CONFLICT (profile_id) DO UPDATE SET
    state_json = excluded.state_json;

  RETURN updated_state;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_global_ranking(p_profile_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.global_rankings
  WHERE profile_id = p_profile_id;
$$;

CREATE OR REPLACE FUNCTION public.get_prediction(
  p_prediction_key text,
  p_profile_id uuid
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT state_json
  FROM public.predictions
  WHERE profile_id = p_profile_id
    AND prediction_key = p_prediction_key;
$$;

CREATE OR REPLACE FUNCTION public.save_prediction(
  p_prediction_key text,
  p_profile_id uuid,
  p_state jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_state jsonb := jsonb_set(
    coalesce(p_state, '{}'::jsonb),
    '{updatedAt}',
    to_jsonb(now()::text),
    true
  );
BEGIN
  INSERT INTO public.predictions (profile_id, prediction_key, state_json)
  VALUES (p_profile_id, p_prediction_key, updated_state)
  ON CONFLICT (profile_id, prediction_key) DO UPDATE SET
    state_json = excluded.state_json;

  RETURN updated_state;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_prediction(
  p_prediction_key text,
  p_profile_id uuid
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.predictions
  WHERE profile_id = p_profile_id
    AND prediction_key = p_prediction_key;
$$;

CREATE OR REPLACE FUNCTION public.ranker_setup_status()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'ok', true,
    'profilesTable', to_regclass('public.profiles') IS NOT NULL,
    'rankingsTable', to_regclass('public.rankings') IS NOT NULL,
    'favoritesTable', to_regclass('public.favorites') IS NOT NULL,
    'comparisonsTable', to_regclass('public.comparisons') IS NOT NULL,
    'globalRankingsTable', to_regclass('public.global_rankings') IS NOT NULL,
    'predictionsTable', to_regclass('public.predictions') IS NOT NULL,
    'triviaSessionsTable', to_regclass('public.trivia_sessions') IS NOT NULL,
    'rankingSnapshotsTable', to_regclass('public.ranking_snapshots') IS NOT NULL,
    'comparisonStatusTable', to_regclass('public.comparison_status') IS NOT NULL,
    'checkedAt', now()::text
  );
$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_ranker_password(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.signup_profile(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.login_profile(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ranking(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_ranking(uuid, text, text[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_ranking(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_favorites(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_favorites(uuid, text[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_comparison(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_comparison(text, uuid, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_comparison(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_global_ranking(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_global_ranking(uuid, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_global_ranking(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_prediction(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_prediction(text, uuid, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_prediction(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ranker_setup_status() TO anon, authenticated;

SELECT pg_notify('pgrst', 'reload schema');

-- Ranking snapshots and comparison completion status

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


-- Trivia save/resume sessions

CREATE TABLE IF NOT EXISTS public.trivia_sessions (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  state_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trivia_sessions_state_object CHECK (jsonb_typeof(state_json) = 'object')
);

DROP TRIGGER IF EXISTS trivia_sessions_touch_updated_at ON public.trivia_sessions;
CREATE TRIGGER trivia_sessions_touch_updated_at
BEFORE UPDATE ON public.trivia_sessions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.trivia_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct trivia session access" ON public.trivia_sessions;
CREATE POLICY "No direct trivia session access"
ON public.trivia_sessions
AS PERMISSIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

DROP FUNCTION IF EXISTS public.get_trivia_session(uuid);
DROP FUNCTION IF EXISTS public.get_trivia_session_metadata(uuid);
DROP FUNCTION IF EXISTS public.save_trivia_session(uuid, jsonb);
DROP FUNCTION IF EXISTS public.clear_trivia_session(uuid);

CREATE OR REPLACE FUNCTION public.get_trivia_session(p_profile_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT state_json
  FROM public.trivia_sessions
  WHERE profile_id = p_profile_id;
$$;

CREATE OR REPLACE FUNCTION public.get_trivia_session_metadata(p_profile_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN session.profile_id IS NULL THEN
      jsonb_build_object('hasSession', false, 'savedAt', NULL)
    ELSE
      jsonb_build_object(
        'hasSession', true,
        'savedAt', session.state_json->>'savedAt'
      )
    END
  FROM (SELECT 1) seed
  LEFT JOIN public.trivia_sessions session
    ON session.profile_id = p_profile_id;
$$;

CREATE OR REPLACE FUNCTION public.save_trivia_session(
  p_profile_id uuid,
  p_state jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_state jsonb := coalesce(p_state, '{}'::jsonb);
BEGIN
  INSERT INTO public.trivia_sessions (profile_id, state_json)
  VALUES (p_profile_id, updated_state)
  ON CONFLICT (profile_id) DO UPDATE SET
    state_json = excluded.state_json;

  RETURN updated_state;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_trivia_session(p_profile_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.trivia_sessions
  WHERE profile_id = p_profile_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_trivia_session(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_trivia_session_metadata(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_trivia_session(uuid, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_trivia_session(uuid) TO anon, authenticated;

SELECT pg_notify('pgrst', 'reload schema');
