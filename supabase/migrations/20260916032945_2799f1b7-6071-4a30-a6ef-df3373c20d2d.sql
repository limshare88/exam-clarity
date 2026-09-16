-- Backs the new "Ask a question" chat in the practice page. Each row is a short,
-- AI-summarised record of what one chat session was about -- not the raw conversation
-- (no need to retain that), just enough for generateReinforceQuestion to target the same
-- doubts later, the same way it already uses session_logs.struggle_tags and
-- vocab_stumble_blocks.word as signals.
CREATE TABLE public.chat_doubts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  board TEXT,
  question_text TEXT,
  doubt_tags TEXT[] NOT NULL DEFAULT '{}',
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_doubts TO authenticated;
GRANT ALL ON public.chat_doubts TO service_role;
ALTER TABLE public.chat_doubts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own chat doubts" ON public.chat_doubts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
