# Instructions for coding agents (Codex and others)

This repo is TARAhut Haazri, a staff attendance app (Expo app + Vercel backend + Supabase).

Read these two files before doing anything:
1. `CLAUDE.md`: the full project handover (what is where, how it works, accounts, env vars, commands). It applies to
   every agent, not only Claude. Keep it up to date when you change how something works.
2. `docs/HANDOFF.md`: where the work stands right now and what is next.

## Rules (all agents)
- Never print or commit secrets: keys, REVIEW_CODE, CRON_SECRET, keystores, google-services.json, service accounts,
  Vercel env values.
- Do not modify the CRM repo `peeenudotcom/tarahut-ams`; this app has its own backend.
- Work on a branch and open a PR. Merge to `main` only when the owner says "merge", using the full commit SHA.
  Production (Vercel) deploys from `main`.
- Never change or delete the store review accounts (phones 9000000001 and 9000000002 in "Demo Company") while a
  store review is open.
- Database changes go in a new numbered file in `backend/supabase/migrations/` (next is `017_…`), applied in order.
- Keep `cd backend && npm test` passing. App text goes in `src/i18n/strings/<screen>.js` with every key in en, pa and
  hi. Use the design kit in `src/ui` (tokens in `src/ui/tokens.js`), no ad-hoc colours.
- Don't commit an unrelated `package-lock.json` change from `npm install` (`git checkout -- package-lock.json`).
- Don't sign the owner up for paid services without asking.
- The owner (Parveen Sukhija) is not a developer: explain in plain language with exact click paths and the exact
  commands to paste.
