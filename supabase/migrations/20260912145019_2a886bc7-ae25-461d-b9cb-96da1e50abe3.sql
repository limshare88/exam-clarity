ALTER TABLE public.exam_questions
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS paper_type text,
  ADD COLUMN IF NOT EXISTS exam_year integer;

CREATE INDEX IF NOT EXISTS exam_questions_subject_paper_year_idx
  ON public.exam_questions (user_id, subject, paper_type, exam_year);