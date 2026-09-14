-- Marks were only ever tracked as one total per whole question. Many boards print a
-- separate mark allocation for each sub-part instead (e.g. "(1)" after part (a), "(2)"
-- after part (b)(ii)), and the extraction step was discarding those individual figures
-- after summing them into the single total -- there was nowhere to keep them.
--
-- `part_marks` mirrors the `diagrams` column's anchor approach rather than asking the AI
-- to reproduce our internal part-path syntax (unreliable across boards): each entry is
-- `{ "anchor": string, "marks": number }`, where `anchor` is a verbatim quote from the
-- end of the specific sub-part's own question_text, matched against the same parser that
-- renders the page (see practice.tsx) to find which part it belongs to.
--
-- Empty is a real, common answer here -- many boards only total the whole question with
-- no per-part breakdown printed anywhere, and that's simply not recoverable after the
-- fact, so this stays an empty array for those questions rather than a guess.
ALTER TABLE public.exam_questions
  ADD COLUMN IF NOT EXISTS part_marks jsonb NOT NULL DEFAULT '[]'::jsonb;
