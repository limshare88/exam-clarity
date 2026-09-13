-- A question can print more than one diagram, each belonging to a different
-- sub-part (e.g. an answer-options table for part (a)(i) and a separate graph
-- for part (b)). The previous single `image_url` column could only hold one
-- image per question, so a second diagram on the same question was silently
-- lost during extraction. `diagrams` replaces that with an array; each entry
-- is `{ "label": string, "url": string }`, where `label` is the sub-part path
-- the diagram belongs to (e.g. "(a)(i)", "(b)"), or "" when the diagram
-- belongs to the question as a whole rather than one specific labelled part.
--
-- `image_url` is kept, unused by new uploads, so existing rows and any other
-- code that still reads it keep working; the app now prefers `diagrams` and
-- only falls back to `image_url` when `diagrams` is empty.
ALTER TABLE public.exam_questions
  ADD COLUMN IF NOT EXISTS diagrams jsonb NOT NULL DEFAULT '[]'::jsonb;
