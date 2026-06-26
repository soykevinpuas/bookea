-- Migration: 048_fix_handle_new_user_trigger
-- Bookea - Fix handle_new_user() trigger: re-add INSERT INTO public.users
-- Mig 043 incorrectly removed the INSERT INTO public.users, leaving only
-- INSERT INTO public.profiles. Since profiles.user_id has a FK to users(id),
-- new user registration fails with "Database error saving new user".

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.users (id, email, role)
    VALUES (NEW.id, NEW.email, 'free');

    INSERT INTO public.profiles (user_id, id)
    VALUES (NEW.id, NEW.id);

    RETURN NEW;
END;
$$;
