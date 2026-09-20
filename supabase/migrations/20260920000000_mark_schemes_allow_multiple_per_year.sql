-- One subject can have several marking schemes in the same year (Jan / June / Oct sittings).
-- The old index allowed only one per subject + paper + year, so a new upload silently
-- replaced the previous one. Uniqueness now also includes the file name, so uploading a
-- DIFFERENT file adds a scheme and re-uploading the SAME file replaces it.
DROP INDEX IF EXISTS public.mark_schemes_unique_paper_idx;

CREATE UNIQUE INDEX IF NOT EXISTS mark_schemes_unique_file_idx
  ON public.mark_schemes (user_id, subject, COALESCE(paper_type, ''), COALESCE(exam_year, 0), COALESCE(original_name, ''));
