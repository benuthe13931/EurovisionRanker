-- Paste this into Supabase SQL Editor after running schema.sql.
-- It verifies that the tables and RPC functions exist with the argument names PostgREST needs.

select public.ranker_setup_status() as setup_status;

select
  n.nspname as schema,
  p.proname as function_name,
  p.proargnames as argument_names,
  pg_get_function_identity_arguments(p.oid) as identity_arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'ranker_setup_status',
    'signup_profile',
    'login_profile',
    'get_ranking',
    'save_ranking',
    'clear_ranking',
    'get_favorites',
    'save_favorites',
    'get_comparison',
    'save_comparison',
    'clear_comparison'
  )
order by p.proname;

-- Optional direct RPC-body equivalent test. Replace values, then run.
-- select public.signup_profile(
--   p_name := 'Test User',
--   p_password := 'Password1!',
--   p_username := 'test_user_' || floor(random() * 1000000)::text
-- );
