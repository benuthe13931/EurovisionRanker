CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  name text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_idx ON profiles (lower(username));

CREATE TABLE IF NOT EXISTS rankings (
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ranking_key text NOT NULL,
  song_ids_json jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, ranking_key)
);

CREATE TABLE IF NOT EXISTS favorites (
  profile_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  song_ids_json jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comparisons (
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  comparison_key text NOT NULL,
  state_json jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, comparison_key)
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparisons ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION validate_ranker_password(password text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF length(password) < 8 OR length(password) > 20 THEN RETURN 'Password must be 8-20 characters.'; END IF;
  IF password !~ '[a-z]' THEN RETURN 'Password needs at least one lowercase letter.'; END IF;
  IF password !~ '[A-Z]' THEN RETURN 'Password needs at least one capital letter.'; END IF;
  IF password !~ '[0-9]' THEN RETURN 'Password needs at least one number.'; END IF;
  IF password !~ '[^A-Za-z0-9]' THEN RETURN 'Password needs at least one symbol.'; END IF;
  RETURN '';
END;
$$;

CREATE OR REPLACE FUNCTION signup_profile(p_name text, p_username text, p_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_name text := trim(p_name);
  clean_username text := trim(p_username);
  password_error text := validate_ranker_password(p_password);
  created_profile profiles%ROWTYPE;
BEGIN
  IF clean_name = '' THEN RAISE EXCEPTION 'Enter your name.'; END IF;
  IF clean_username = '' THEN RAISE EXCEPTION 'Enter a username.'; END IF;
  IF length(clean_name) > 32 THEN RAISE EXCEPTION 'Name must be 32 characters or fewer.'; END IF;
  IF length(clean_username) > 24 THEN RAISE EXCEPTION 'Username must be 24 characters or fewer.'; END IF;
  IF clean_username !~ '^[a-zA-Z0-9_-]+$' THEN
    RAISE EXCEPTION 'Username can only use letters, numbers, underscores, and hyphens.';
  END IF;
  IF password_error <> '' THEN RAISE EXCEPTION '%', password_error; END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE lower(username) = lower(clean_username)) THEN
    RAISE EXCEPTION 'That profile already exists.';
  END IF;

  INSERT INTO profiles (username, name, password_hash)
  VALUES (clean_username, clean_name, crypt(p_password, gen_salt('bf')))
  RETURNING * INTO created_profile;

  RETURN jsonb_build_object('id', created_profile.id::text, 'name', created_profile.name, 'username', created_profile.username);
END;
$$;

CREATE OR REPLACE FUNCTION login_profile(p_username text, p_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile profiles%ROWTYPE;
BEGIN
  SELECT * INTO profile FROM profiles WHERE lower(username) = lower(trim(p_username));

  IF profile.id IS NULL THEN RAISE EXCEPTION 'Profile not found.'; END IF;
  IF profile.password_hash <> crypt(p_password, profile.password_hash) THEN
    RAISE EXCEPTION 'Incorrect password.';
  END IF;

  RETURN jsonb_build_object('id', profile.id::text, 'name', profile.name, 'username', profile.username);
END;
$$;

CREATE OR REPLACE FUNCTION get_ranking(p_profile_id uuid, p_ranking_key text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN r.profile_id IS NULL THEN NULL ELSE jsonb_build_object(
    'key', r.ranking_key,
    'songIds', r.song_ids_json,
    'updatedAt', r.updated_at
  ) END
  FROM (SELECT 1) seed
  LEFT JOIN rankings r ON r.profile_id = p_profile_id AND r.ranking_key = p_ranking_key;
$$;

CREATE OR REPLACE FUNCTION save_ranking(p_profile_id uuid, p_ranking_key text, p_song_ids text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  saved rankings%ROWTYPE;
BEGIN
  INSERT INTO rankings (profile_id, ranking_key, song_ids_json, updated_at)
  VALUES (p_profile_id, p_ranking_key, to_jsonb(p_song_ids), now())
  ON CONFLICT (profile_id, ranking_key) DO UPDATE SET song_ids_json = excluded.song_ids_json, updated_at = excluded.updated_at
  RETURNING * INTO saved;

  RETURN jsonb_build_object('key', saved.ranking_key, 'songIds', saved.song_ids_json, 'updatedAt', saved.updated_at);
END;
$$;

CREATE OR REPLACE FUNCTION clear_ranking(p_profile_id uuid, p_ranking_key text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM rankings WHERE profile_id = p_profile_id AND ranking_key = p_ranking_key;
$$;

CREATE OR REPLACE FUNCTION get_favorites(p_profile_id uuid)
RETURNS text[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(value), ARRAY[]::text[])
  FROM favorites f
  CROSS JOIN LATERAL jsonb_array_elements_text(f.song_ids_json) AS value
  WHERE f.profile_id = p_profile_id;
$$;

CREATE OR REPLACE FUNCTION save_favorites(p_profile_id uuid, p_song_ids text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  saved favorites%ROWTYPE;
BEGIN
  INSERT INTO favorites (profile_id, song_ids_json, updated_at)
  VALUES (p_profile_id, to_jsonb(p_song_ids), now())
  ON CONFLICT (profile_id) DO UPDATE SET song_ids_json = excluded.song_ids_json, updated_at = excluded.updated_at
  RETURNING * INTO saved;

  RETURN jsonb_build_object('songIds', saved.song_ids_json, 'updatedAt', saved.updated_at);
END;
$$;

CREATE OR REPLACE FUNCTION get_comparison(p_profile_id uuid, p_comparison_key text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT state_json FROM comparisons WHERE profile_id = p_profile_id AND comparison_key = p_comparison_key;
$$;

CREATE OR REPLACE FUNCTION save_comparison(p_profile_id uuid, p_comparison_key text, p_state jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_state jsonb := jsonb_set(p_state, '{updatedAt}', to_jsonb(now()::text));
BEGIN
  INSERT INTO comparisons (profile_id, comparison_key, state_json, updated_at)
  VALUES (p_profile_id, p_comparison_key, updated_state, now())
  ON CONFLICT (profile_id, comparison_key) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at;

  RETURN updated_state;
END;
$$;

CREATE OR REPLACE FUNCTION clear_comparison(p_profile_id uuid, p_comparison_key text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM comparisons WHERE profile_id = p_profile_id AND comparison_key = p_comparison_key;
$$;
