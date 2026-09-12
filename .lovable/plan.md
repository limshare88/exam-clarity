# Diagrams, paper/year filters, and sub-question breakouts

## 1. Diagrams attached to questions

When a paper is uploaded, each page is turned into a picture inside the browser. The reader is asked, for every question, whether that question has a diagram, chart, graph or illustration, and where it sits on the page. If it does, that part of the page is cut out, saved to storage, and its link is stored with the question.

Practice, Challenge and Reinforce show the diagram in a soft framed panel directly above the question text, with a tap-to-enlarge view. Questions without a diagram look exactly as they do today.

## 2. Paper and year grouping

The question bank gains two new fields: paper type (Paper 1, Paper 2, ...) and exam year. The reader picks these up from the paper's own cover/header text when printed; the upload screen also lets the parent set them, and the parent's choice wins.

Everything stays in the one question bank — no separate files. On the workspace screen the student picks, in order:

1. Subject
2. Paper (each paper found for that subject, or "All Papers")
3. Year (each year found, or "All Years / Random")

Only then does "Get a question" pull a random unseen question from that filtered set. Paper and Year lists are built from what actually exists for the chosen subject, so empty combinations never appear.

## 3. Sub-question breakouts

A question with parts (1a, 1b, 1(ii)) is never shown as one dense block. The formatter splits it into separate labelled segments, each with a bold part label, an indent, and generous spacing between segments.

The strategy area follows the same split: one separate step box per sub-part, each with its own voice-note button. The coach receives the parts separately and returns feedback per part — its own score, logic, sequencing, formula and missing-step notes for 1(a) and for 1(b) — plus one overall score and one warm closing line. Questions with no sub-parts keep the single step box and single feedback card.

## Technical details

- Migration: add `image_url text`, `paper_type text`, `exam_year integer` to `exam_questions` (nullable, no backfill needed); regenerate types.
- New `src/lib/question-parts.ts`: pure `splitQuestionParts(text)` returning `{ label, text }[]`, matching `(a)`, `a)`, `(ii)`, `1a` style markers at segment starts; returns a single unlabelled part when none found. Shared by the renderer, the blueprint canvas and the coach payload.
- Upload pipeline (`admin.tsx`): keep instant auto-save and the duplicate check. Add client-side page rasterisation via `pdfjs-dist` (PDF) or an image bitmap (screenshot) on a `<canvas>`; send the page image to the extractor.
- `extractExamQuestions` (`ai.functions.ts`): extend the JSON contract with `has_diagram`, `diagram_box` (normalised `x, y, w, h` on the page), `paper_type`, `exam_year`, `parts`. Keep the existing strict front-matter filtering and mark rules unchanged.
- For each returned `diagram_box`, crop from the rasterised canvas client-side, upload the PNG to `exam-uploads` under `<uid>/diagrams/`, and store a long-lived signed URL in `image_url`.
- `coachStrategy`: accept `parts: { label, question_text, strategy }[]`; prompt grades each part independently under the same board rubric and returns `part_feedback[]` plus overall `score` and `encouragement`. Existing single-part callers keep working through a one-element array.
- `practice.tsx`: paper/year filter state feeding the bank query; diagram `<img>` with alt text above `VocabText`; per-part step boxes keyed by label; per-part feedback cards. Session log keeps one row per question, with part feedback inside `ai_feedback`.
- Verify with a real upload through the AI reader, then check the workspace filters and part boxes at mobile width.
