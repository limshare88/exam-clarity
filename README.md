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

## Daily database backup

`.github/workflows/backup.yml` backs up the database every day at 3:17 am (Malaysia time) and keeps each
backup privately in this GitHub repo for 30 days. Only people with access to the repo can download them.
Uploaded exam-paper PDFs/images themselves aren't included — they can always be re-uploaded from the
original files, and leaving them out keeps the backup small.

**One-time setup**

1. In Supabase, open the `exam-clarity` project and click **Connect** at the top.
2. Choose **Session pooler** (not "Direct connection", which GitHub can't reach) and copy the URI. It looks like
   `postgresql://postgres.zuqjttyksvrszaxbvlvo:[YOUR-PASSWORD]@aws-…pooler.supabase.com:5432/postgres`.
3. Replace `[YOUR-PASSWORD]` with the database password (no brackets). If you don't know it:
   Project Settings → Database → **Reset database password**. This doesn't affect the app's own keys.
4. On GitHub, open this repo → Settings → Secrets and variables → Actions → **New repository secret**.
   Name: `EXAM_CLARITY_DB_URL`. Value: the full URI from step 3.
5. Actions tab → **Daily database backup** → **Run workflow**. After 1 to 2 minutes it should show a green tick,
   with a backup file (for example `exam-clarity-backup-2026-11-26-1`) at the bottom of the run page.

If a backup fails, GitHub emails you. Check the Actions tab.

**Downloading or restoring a backup**

Actions tab → Daily database backup → open a run → download the backup at the bottom. It holds
`roles.sql`, `schema.sql` and `data.sql`. To restore into an empty Supabase project, run these in order
(the connection string is that project's Session pooler URI):

```
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file roles.sql --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql --dbname "postgresql://…"
```
