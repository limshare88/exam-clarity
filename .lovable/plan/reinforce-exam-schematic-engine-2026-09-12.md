# Reinforce Exam Schematic Engine

## Build
- Extend Reinforce question generation with a strict structured schematic description when a diagram materially supports the question.
- Cover Physics force, circuit, wave, and ray diagrams; Chemistry apparatus and bonding; Biology cell, division, and organ diagrams; Mathematics graphs, integration regions, trigonometric curves, geometry, and circle theorems.
- Render the description as safe in-app vector line art rather than accepting executable drawing markup from AI.
- Show the diagram with the generated question in Reinforce Mode, using monochrome print styling and readable labels.

## Technical details
- Add a typed, allowlisted schematic schema with validated diagram kinds, labels, and numeric parameters.
- Build a reusable SVG renderer with crisp strokes, clear backgrounds, wide label spacing, and scalable mobile sizing.
- Update the AI prompt and response normalization so unsupported or malformed diagrams degrade to a text-only question.
- Test the live AI call, type safety, build output, and the mobile workspace.
