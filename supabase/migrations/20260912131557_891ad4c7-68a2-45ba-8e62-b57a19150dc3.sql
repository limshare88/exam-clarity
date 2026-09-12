ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS active_mascot text NOT NULL DEFAULT 'mascot-chibi';

ALTER TABLE public.user_profiles
ADD CONSTRAINT user_profiles_active_mascot_check
CHECK (active_mascot IN ('mascot-chibi', 'mascot-long-ear', 'mascot-robot'));