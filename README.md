# Exam Clarity

Build a mobile-first educational Progressive Web App (PWA) named "ExamPulse" designed for a student with dyslexia and autism to improve exam question processing speed, sentence structure decoding, and pattern recognition. The layout must be highly sensory-friendly, utilizing high-contrast readable layouts, extra wide letter/line spacing, soft pastel background surfaces (lavender, mint green, warm cream), and large, distinct button hit-targets to prevent cognitive or motor overload.

Please implement the following screen views, database collections, and layout workflows:

1. Initial Login & Onboarding Flow:

- A clean, welcoming "First Time Login" screen using a passwordless or social sign-in interface.

- Profile Setup View: Mandate text input fields for Name and Age.

- Subject-to-Board Mapping Matrix: For each active subject checked (Mathematics, Physics, Chemistry, Biology, English C1/C2 focus), provide an individual dropdown allowing the user to select the specific exam board for that subject alone (e.g., Mathematics: Pearson Edexcel; Chemistry: Cambridge CIE; English: Cambridge C1).

- Learning Profile Matrix: A friendly checklist for "Dyslexia", "Autism Spectrum", or "ADHD" to automatically tailor font spacing and UI tone.

2. Parent/Teacher Document Scanner & Admin View:

- A secure dashboard layout to upload past-year exam questions using Screenshots (image upload) or PDF files.

- Database Administration Panel: Create 3 action buttons: "🗑️ Reset Practice History" (Clears session logs), "🪙 Reset Coins & Inventory", and "❌ Clear All Exam Questions".

- Selective Reset Timeframe: Above the reset buttons, include a "Select Timeframe" dropdown with options for "All-Time History", "By Calendar Month" (displays a month-picker), and "Custom Date Range" (displays interactive From/To calendar pickers). Filter out and clear only the database rows matching the chosen timestamp window. Require typing "RESET" in a confirmation popup to execute.

3. Interactive Question Workspace (Core View with 3 Practice Modes):

- Include a sticky bottom navigation bar to switch screens. Mode selection options:

  a) Practice Mode: Un-timed. Includes a "Read Aloud" button that reads text in a slow, natural voice. Features a "Deconstruct" button that parses dense paragraphs into 3 clean visual blocks: "📌 The Core Goal", "⚙️ Command Words", and "🧪 Extracted Facts/Data".

  b) Challenge Mode: The same layout as Practice, but pulls a custom timer setting from the user's Settings view (options: 45s, 1m, 2m, 3m). A visual countdown progress bar shrinks smoothly from green to yellow to red without triggering loud alarms.

  c) Reinforce Mode (Adaptive Engine): Scans historical error logs and automatically serves simulated, freshly generated AI questions matching her exact struggle patterns or clicked vocabulary words until mastered.

- Subject-Specific Interactive Vocabulary Assistant: Make every word within the displayed exam question text clickable/tappable. Clicking a word opens a clean popup card providing a simple definition, an everyday example, and a highly specific explanation of how that word functions explicitly within the context of the active subject (e.g., "degrade" in Biology vs everyday use). Save every clicked word into her "Stumble Blocks" history linked to her user_id.

- Formula-Focused AI Coach: Display a prominent sub-label: "📝 Goal: State your strategy step-by-step and name the formulas or rules you will use. You do NOT need to calculate the final math working." The backend AI Coach must validate ONLY her thinking logic, sequencing, and formula selections based on her chosen subject's exam board rubrics, completely ignoring the lack of numerical calculations or final text essays. Include a prominent microphone button that simulates recording her voice explanation and populating the strategy text box automatically.

4. Progress Analytics Dashboard (User Isolated):

- Interactive line charts tracking her average question processing time (seconds per mark) over a 7-day or 30-day timeline.

- Subject Mastery Summary: A clean grid showing performance percentages across Math, Science, and English.

- AI Stumble Block Box: A text box summarizing the concepts, command words, and technical vocabulary she currently finds most difficult.

5. Anime Character Gamification System (Motivation Center):

- Feature a cute interactive anime mascot character widget right on the dashboard.

- Earn Points: Completing blueprints, beating timers, or finishing Reinforce drills awards "Pulse Coins" and stars.

- Dress-Up & Toy Shop: A clean reward store interface where she can spend her earned coins to buy digital accessories for her anime character (e.g., cute hats, customizable outfits, desk toys, and room background wallpapers) which can be instantly clicked to equip.

6. Data Storage & Privacy:

- Isolate user data dynamically by tagging every entry with a unique 'user_id' string across five distinct, collections: user_profiles, exam_questions, session_logs, vocab_stumble_blocks, and gamification_inventory. Ensure these collections are structured dynamically to support future external spreadsheet or cloud connector linking.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/56bc7c77-ed6d-4f6f-8bfa-204ceb632015).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
