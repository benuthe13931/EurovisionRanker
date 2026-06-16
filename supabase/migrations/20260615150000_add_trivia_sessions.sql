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
  updated_state jsonb := jsonb_set(
    coalesce(p_state, '{}'::jsonb),
    '{savedAt}',
    to_jsonb(now()::text),
    true
  );
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
GRANT EXECUTE ON FUNCTION public.save_trivia_session(uuid, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_trivia_session(uuid) TO anon, authenticated;

SELECT pg_notify('pgrst', 'reload schema');
