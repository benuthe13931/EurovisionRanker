# Supabase Setup

## GitHub Actions Deployment

This repo includes Supabase CLI migrations in `supabase/migrations` and a deployment workflow at `.github/workflows/deploy-supabase.yml`.

Add these repository secrets in GitHub before relying on the workflow:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_PROJECT_ID`

The workflow runs `supabase db push` on pushes to `main` when Supabase files change. Do not commit secret values.

## Manual Setup

Open your Supabase project, go to **SQL Editor**, create a new query, paste the full contents of `supabase/schema.sql`, and run it.

That one file creates the required extension, tables, indexes, `updated_at` triggers, RLS policies, and every RPC function the app calls:

- `ranker_setup_status`
- `signup_profile`
- `login_profile`
- `get_ranking`
- `save_ranking`
- `clear_ranking`
- `get_favorites`
- `save_favorites`
- `get_comparison`
- `save_comparison`
- `clear_comparison`

No seed data is needed in Supabase right now. Eurovision years and songs are bundled in the app under `src/data/years`.

After running the SQL, set these Vercel environment variables:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Then redeploy the Vercel app. If Supabase still says a function is missing, wait a few seconds and redeploy/retry. The schema ends with `NOTIFY pgrst, 'reload schema';` to refresh PostgREST's schema cache.

If you previously ran an older version of the schema, run this full file again. It explicitly drops and recreates the text-only auth RPCs so Postgres does not keep stale argument names in the PostgREST schema cache.

The password RPCs call `extensions.crypt` and `extensions.gen_salt`, which is where Supabase normally exposes `pgcrypto`.

Optional smoke test in SQL Editor after setup:

```sql
select public.ranker_setup_status();
```

For a fuller check, paste and run `supabase/diagnostics.sql`. The `signup_profile` row should show these argument names:

```text
{p_name,p_password,p_username}
```
