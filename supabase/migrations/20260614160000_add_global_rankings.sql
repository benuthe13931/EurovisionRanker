CREATE TABLE IF NOT EXISTS public.global_rankings (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  state_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT global_rankings_state_object CHECK (jsonb_typeof(state_json) = 'object')
);

DROP TRIGGER IF EXISTS global_rankings_touch_updated_at ON public.global_rankings;
CREATE TRIGGER global_rankings_touch_updated_at
BEFORE UPDATE ON public.global_rankings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.global_rankings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct global ranking access" ON public.global_rankings;
CREATE POLICY "No direct global ranking access"
ON public.global_rankings
AS PERMISSIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

DROP FUNCTION IF EXISTS public.get_global_ranking(uuid);
DROP FUNCTION IF EXISTS public.save_global_ranking(uuid, jsonb);
DROP FUNCTION IF EXISTS public.clear_global_ranking(uuid);

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

GRANT EXECUTE ON FUNCTION public.get_global_ranking(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_global_ranking(uuid, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_global_ranking(uuid) TO anon, authenticated;

SELECT pg_notify('pgrst', 'reload schema');
