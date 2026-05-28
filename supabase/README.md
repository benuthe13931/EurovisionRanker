# Supabase Setup

Open your Supabase project, go to **SQL Editor**, create a new query, paste the full contents of `supabase/schema.sql`, and run it.

That one file creates the required extension, tables, indexes, `updated_at` triggers, RLS policies, and every RPC function the app calls:

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
