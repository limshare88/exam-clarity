# Exam Clarity

A mobile-first exam-practice Progressive Web App (PWA) for a student with dyslexia and autism, built to improve exam question processing speed, sentence structure decoding, and pattern recognition. The layout is sensory-friendly: high-contrast readable text, extra wide letter/line spacing, soft pastel backgrounds (lavender, mint, warm cream), and large, distinct button hit-targets.

## Stack

- TypeScript, React 19, TanStack Start/Router, Vite, Tailwind v4
- Supabase (database, auth)
- Vercel (hosting)
- AI: Claude, OpenAI and Gemini, called directly with their own API keys

## Key features

1. **Onboarding** — passwordless/social sign-in, profile setup, per-subject exam-board mapping, and a learning-profile checklist (dyslexia / autism / ADHD) that tailors spacing and tone.
2. **Parent/teacher admin view** — upload past-year exam questions (screenshots or PDFs); reset practice history, coins/inventory, or exam questions by timeframe, with a typed "RESET" confirmation.
3. **Practice workspace** with three modes:
   - **Practice** (un-timed): "Read Aloud" and "Deconstruct" (splits a question into Core Goal / Command Words / Extracted Facts).
   - **Challenge** (timed, 45s–3m, a calm green→yellow→red countdown).
   - **Reinforce** (adaptive): serves fresh AI-generated questions matching her recent struggle patterns.
   - Tap any word in a question for a plain-English definition plus a subject-specific explanation (saved to her "Stumble Blocks" history).
   - **AI Coach**: checks only her stated strategy, step sequencing and formula/rule choices — not the final numeric answer — and explains *why* a formula does or doesn't fit, with links to similar uploaded questions using the same formula.
4. **Progress dashboard** — processing-time trends, subject mastery grid, and a summary of her most common stumble points.
5. **Gamification** — an anime mascot, Pulse Coins/stars earned through practice, and a dress-up shop.

## Development

```sh
git clone https://github.com/limshare88/exam-clarity
cd exam-clarity
npm i
npm run dev
```

Requires a `.env` with the Supabase project's URL and keys — see `.env` for the variable names.
