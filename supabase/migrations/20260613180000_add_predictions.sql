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

DROP TRIGGER IF EXISTS predictions_touch_updated_at ON public.predictions;
CREATE TRIGGER predictions_touch_updated_at
BEFORE UPDATE ON public.predictions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct prediction access" ON public.predictions;
CREATE POLICY "No direct prediction access"
ON public.predictions
AS PERMISSIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

DROP FUNCTION IF EXISTS public.get_prediction(uuid, text);
DROP FUNCTION IF EXISTS public.get_prediction(text, uuid);
DROP FUNCTION IF EXISTS public.save_prediction(uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.save_prediction(text, uuid, jsonb);
DROP FUNCTION IF EXISTS public.clear_prediction(uuid, text);
DROP FUNCTION IF EXISTS public.clear_prediction(text, uuid);

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
    'predictionsTable', to_regclass('public.predictions') IS NOT NULL,
    'checkedAt', now()::text
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_prediction(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_prediction(text, uuid, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_prediction(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ranker_setup_status() TO anon, authenticated;

SELECT pg_notify('pgrst', 'reload schema');
