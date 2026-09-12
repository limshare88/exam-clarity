# Nested sub-question hierarchy

## What will change

- Upgrade the question parser to distinguish lettered parent parts such as `(a)` from Roman-numeral child parts such as `(i)` and `(ii)`.
- Keep introductory text attached to its parent part rather than turning it into a separate question.
- Preserve ordinary single-level questions and multiple-choice questions exactly as they work today.
- Render each parent scenario once, with its child questions indented directly beneath it inside the same question card.
- Keep one strategy box per actionable leaf question, carrying its parent context into coach evaluation.

## Technical details

- Extend `QuestionPart` with nested `children` and parse marker sequences into a small hierarchy.
- Add a helper that returns actionable leaf parts with stable hierarchical labels such as `(a)(i)`.
- Update the practice question renderer to recursively display nested parts and use the leaf helper for strategy boxes and coach payloads.
- Verify parser examples, type safety, and the current build diagnostics.
