# Faculty Timetable

LMS-style professor schedules with a separate admin sign-in. No example names or classes are seeded.

## Vercel setup

Import this repository into Vercel. Use Framework Preset **Other**, Build Command **npm run build**, and Output Directory **public**. These defaults are also declared in vercel.json. Clear any conflicting Project Settings overrides. The API function in api/config.js serves the public Supabase connection settings; the browser reads and writes through Supabase's authenticated Data API.

Add these Vercel environment variables for each environment you use, then redeploy:

- SUPABASE_URL: your Supabase project URL.
- SUPABASE_PUBLISHABLE_KEY: the project's publishable key (a legacy anon key also works).

Do not use a secret key or service_role key. No database password is required by the app.

## Supabase database setup

Use a new Supabase project. Open SQL Editor and execute supabase/schemas/001_timetable.sql once. This declarative schema creates the schedule, admin membership, policies, and atomic reservation constraints. It does not modify or delete an existing schedule database. Keep public in the exposed Data API schemas.

Only the schedule is publicly readable. Admin memberships are visible only to their respective signed-in users. Membership changes are reserved for the project owner through SQL Editor or equivalent trusted administration.

## Create the first administrator

1. In Supabase Authentication > Users, create the administrator's email/password account and confirm its email. Do not share the password.
2. Copy that account's User UID.
3. In SQL Editor, run the following with the actual UID substituted:

    insert into public.timetable_admins (user_id)
    values ('YOUR-ADMIN-USER-UUID');

4. On the website, select **Admin sign in** and enter that account's email and password.

There is no browser endpoint for granting admin access. Creating an ordinary auth account does not grant admin rights. To revoke access, delete its row from timetable_admins using trusted SQL Editor; subsequent database writes are denied.

## Local checks

Requires Node.js 24 or later:

    npm ci
    npm test
    npm run build

Tests run real PostgreSQL in memory through PGlite, including RLS/grants for anonymous visitors, signed-in viewers and administrators, blocked self-promotion, and resource overlap constraints. No remote project or credentials are required for these tests. For an interactive local session use Vercel CLI: vercel dev, with the two settings in an ignored .env.local file.

## Security model

Everyone can view the published timetable. Only members of timetable_admins can insert, update, or delete classes. PostgreSQL RLS enforces this even when a visitor bypasses the page and calls Supabase directly. A private reservation table and a database exclusion constraint prevent simultaneous professor, room, or group conflicts. Supabase Auth maintains sign-in sessions; the former Sites authentication headers are not used.

Production verification still requires applying the schema to your selected Supabase project and configuring Vercel's environment variables. Local tests do not confirm your remote project settings.
