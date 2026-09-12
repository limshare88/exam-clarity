# ExamPulse parser, coach, and mascot upgrade

## What will change

- Turn uploaded PDFs and screenshots into a reviewable list of numbered exam questions before saving.
- Remove cover-page text, generic instructions, page furniture, copyright lines, and other non-question material.
- Detect each question's printed mark allocation and save every extracted question as its own question-bank entry.
- Strengthen the AI Coach so it grades the selected strategy against the subject's saved exam board, command-word expectations, and mark allocation.
- Replace the simple mascot with three polished, layered character choices: a chibi learner, a long-eared companion, and a helper robot.
- Add a Mascots category to the shop, support unlocking and equipping characters, and save the active mascot to the learner's profile.

## Upload workflow

1. Parent selects a subject and uploads one PDF or screenshot.
2. ExamPulse securely sends the file to the document-reading service.
3. The service returns only numbered questions, with question number, complete question text, and marks.
4. The parent reviews the extracted list and can remove incorrect items.
5. Confirming saves each item with its source file, board, subject, extracted marks, and extraction metadata.

## Character and shop experience

- The mascot scene will use a layered illustration structure: background, base character, outfit, hat, foreground toy, and expression details.
- Existing purchased hats, outfits, toys, and wallpapers continue to work with the new character renderer.
- The starter mascot is available immediately; additional mascots cost Pulse Coins and follow the existing purchase/equip pattern.
- Shop cards clearly show locked, owned, and active states without nested panels.

## Technical details

- Add an authenticated server function for multimodal extraction using Lovable AI, accepting PDF/image data and returning validated structured question objects.
- Use strict extraction instructions and server-side validation to reject empty, non-numbered, or implausible results and normalize marks to positive integers.
- Preserve gateway error messages and apply bounded retries only for rate limits or temporary service errors.
- Update coach output to include the board used and a concise rubric basis, while retaining logic, sequencing, formula/rule, missing-step, and encouragement fields.
- Add `active_mascot` to `user_profiles` through a safe database migration; keep ownership records in the existing inventory collection.
- Add generated character artwork as local project assets and compose customization layers in the mascot component.
- Verify upload extraction with a real AI request, then verify shop and practice flows on mobile and desktop-sized screens.
