
CREATE TABLE public.user_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  age INTEGER,
  subjects JSONB NOT NULL DEFAULT '[]'::jsonb,
  learning_profile TEXT[] NOT NULL DEFAULT '{}',
  timer_seconds INTEGER NOT NULL DEFAULT 60,
  coins INTEGER NOT NULL DEFAULT 0,
  stars INTEGER NOT NULL DEFAULT 0,
  onboarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.user_profiles FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.exam_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  board TEXT,
  question_text TEXT NOT NULL,
  marks INTEGER NOT NULL DEFAULT 1,
  source_type TEXT NOT NULL DEFAULT 'manual',
  file_path TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_questions TO authenticated;
GRANT ALL ON public.exam_questions TO service_role;
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own questions" ON public.exam_questions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.session_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  question_id UUID REFERENCES public.exam_questions(id) ON DELETE SET NULL,
  mode TEXT NOT NULL DEFAULT 'practice',
  subject TEXT,
  marks INTEGER NOT NULL DEFAULT 1,
  time_seconds NUMERIC NOT NULL DEFAULT 0,
  score INTEGER,
  strategy_text TEXT,
  ai_feedback JSONB NOT NULL DEFAULT '{}'::jsonb,
  struggle_tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_logs TO authenticated;
GRANT ALL ON public.session_logs TO service_role;
ALTER TABLE public.session_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sessions" ON public.session_logs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.vocab_stumble_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  word TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT 'General',
  definition TEXT,
  everyday_example TEXT,
  subject_context TEXT,
  click_count INTEGER NOT NULL DEFAULT 1,
  mastered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vocab_stumble_blocks TO authenticated;
GRANT ALL ON public.vocab_stumble_blocks TO service_role;
ALTER TABLE public.vocab_stumble_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own vocab" ON public.vocab_stumble_blocks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.gamification_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  category TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  equipped BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gamification_inventory TO authenticated;
GRANT ALL ON public.gamification_inventory TO service_role;
ALTER TABLE public.gamification_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own inventory" ON public.gamification_inventory FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_exam_questions_updated_at BEFORE UPDATE ON public.exam_questions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "own uploads read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'exam-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own uploads write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'exam-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own uploads delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'exam-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
