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

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comparisons ENABLE ROW LEVEL SECURITY;

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
GRANT EXECUTE ON FUNCTION public.ranker_setup_status() TO anon, authenticated;

SELECT pg_notify('pgrst', 'reload schema');
