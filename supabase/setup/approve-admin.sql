-- Run in Supabase SQL Editor after applying the schema and creating your Auth user.
DO $$
DECLARE admin_id uuid;
BEGIN
 IF to_regclass('public.timetable_admins') IS NULL THEN
   RAISE EXCEPTION 'Run supabase/schemas/001_timetable.sql first to create the admin table.';
 END IF;
 SELECT id INTO admin_id FROM auth.users WHERE lower(email) = lower('alikhan.skyranger@gmail.com');
 IF admin_id IS NULL THEN RAISE EXCEPTION 'Create the intended admin account in Supabase Authentication > Users first.'; END IF;
 INSERT INTO public.timetable_admins(user_id) VALUES(admin_id) ON CONFLICT(user_id) DO NOTHING;
END;
$$;

-- Shows the approved account after the script succeeds.
SELECT a.user_id, u.email
FROM public.timetable_admins a
JOIN auth.users u ON u.id = a.user_id
WHERE lower(u.email) = lower('alikhan.skyranger@gmail.com');
