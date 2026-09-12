CREATE TABLE public.mark_schemes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  subject TEXT NOT NULL,
  board TEXT,
  paper_type TEXT,
  exam_year INTEGER,
  file_path TEXT,
  original_name TEXT,
  scheme_text TEXT NOT NULL DEFAULT '',
  entries JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mark_schemes TO authenticated;
GRANT ALL ON public.mark_schemes TO service_role;

ALTER TABLE public.mark_schemes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own mark schemes"
ON public.mark_schemes FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE UNIQUE INDEX mark_schemes_unique_paper_idx
  ON public.mark_schemes (user_id, subject, COALESCE(paper_type, ''), COALESCE(exam_year, 0));

CREATE INDEX mark_schemes_lookup_idx
  ON public.mark_schemes (user_id, subject, exam_year);

CREATE TRIGGER update_mark_schemes_updated_at
BEFORE UPDATE ON public.mark_schemes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();