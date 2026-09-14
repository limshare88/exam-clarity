-- The Chibi Boy mascot (mascot-chibi-boy) added alongside the existing starter mascot
-- was rejected by this constraint, which only allowed the three mascots that existed
-- when it was first created: "new row for relation 'user_profiles' violates check
-- constraint 'user_profiles_active_mascot_check'".
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_active_mascot_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_active_mascot_check
  CHECK (active_mascot IN ('mascot-chibi', 'mascot-chibi-boy', 'mascot-long-ear', 'mascot-robot'));
