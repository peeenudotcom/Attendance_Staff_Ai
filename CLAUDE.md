# TARAhut Haazri: handover for Claude

Staff attendance app sold to companies (B2B). Owner: Parveen Sukhija. Legal entity **SUKHIJA TECHNO AID**, brand
**TARAhut AI Builds** (tarahutaibuilds.com). Status on 20 Oct 2026: iOS 1.0 (build 15) and Android 1.0 (version code 7,
production track, India) are both submitted for store review. Pilot companies: TARAhutAIBuilds
(own staff) and My Visa Guide (admin Rohit Sethi).

## What is where

| Part | Location | Notes |
| --- | --- | --- |
| Mobile app (Expo SDK 54, RN 0.81) | `App.js`, `src/` (screens, services/api.js, navigation) | iOS + Android, package/bundle `com.tarahut.attendance` |
| Backend API (Vercel functions, Node 24) | `backend/api/**`, shared logic in `backend/lib/` | Deployed at https://haazri.tarahutaibuilds.com/api |
| Web dashboard (admins) | `backend/public/dashboard/` (plain JS) | https://haazri.tarahutaibuilds.com/dashboard |
| Public pages | `backend/public/` (privacy, support, delete-account, get) | Required by the stores |
| Database | Supabase project `oilkvoexlvhkjthpvgfr`, migrations `backend/supabase/migrations/001…016` | Apply new migrations in order; all 16 applied |
| Store material | `docs/PLAY_STORE_LISTING.md`, `docs/APP_STORE_*.md`, `store.config.js` (App Store listing as code), `assets/store/` | Screenshots: `screenshots/` (Play 1080x1920), `ios-screenshots-6.3/` (App Store 1206x2622) |
| Instant app updates | Expo Updates, guide in `docs/APP_UPDATES.md` | Only builds made after it was merged have it (store 1.0 builds do NOT) |
| Config plugins | `plugins/with-adi-registration.js` (Android developer verification token), `plugins/with-android-abis.js` (ARM only) | |

Hosting and accounts (IDs are not secrets):
- Vercel project `prj_HQyVSlkBNdD1HgZAV4icCMrHhMJB`, team `team_Y9raJp0lmrOOAkJAr81ERivV`. Production deploys from `main`.
- Expo/EAS: account `psukhija`, project `tarahut-attendance` (id `ec478f59-dfe9-4b75-9daf-e8f07f33b6a4`). `appVersionSource: remote`.
- App Store Connect app id `6821225746` (Apple team H569T742YT, an Individual account: seller shows as Parveen Sukhija).
- Google Play: organisation account "TARAhut AI Builds", developer id 6816677378185147616.
- Email: Resend, sender `codes@haazri.tarahutaibuilds.com`; replies and support go to `support@tarahutaibuilds.com` (Microsoft 365).
- WhatsApp: Meta business portfolio "TARAhut AI Builds" (already Meta verified), app "TARAhut Haazri", system user
  `haazri-server`, Authentication template `haazri_code` (English, copy code). Delivery webhook:
  `/api/whatsapp/webhook` (logs only; verify token in Vercel env WHATSAPP_VERIFY_TOKEN).

## How it works (essentials)
- Sign-in: phone number, then a 4-digit code sent on WhatsApp (`backend/lib/whatsapp.js`) and by email
  (`backend/lib/otp.js`); either arriving is enough. Staff must be added by an admin first (app and dashboard still
  require an email; making it optional is planned for 1.0.1). Live since 21 Oct 2026.
- Self sign-up: any business creates its company and first admin at https://haazri.tarahutaibuilds.com/start
  (`backend/api/signup.js`, `lib/companies.js`); support gets a "New sign-up" email. Cited in the Apple 3.2 reply.
- Store review accounts: phones in Vercel env `REVIEW_PHONE` (9000000001 staff, 9000000002 admin, both in "Demo
  Company", no location lock) accept the fixed code in Vercel env `REVIEW_CODE` (hidden; owner knows it). Never change
  or delete these while a store review is open.
- Salary extras (Settings in the dashboard): overtime (time beyond the shift, or a normal day for staff without one,
  15+ min a day, paid at 1×/1.5×/2× the hourly rate), paid leave per year (earned monthly, resets in January; casual,
  sick and paid leave use it, requests over the balance are refused), payslips (dashboard Salary → Payslip, signed
  90-day link `/payslip?t=…` to send on WhatsApp; staff see closed months in the app under You → My payslips), daily
  WhatsApp summary to admins (cron `/api/cron/daily-summary` ~11:00 IST, needs Utility template in
  WHATSAPP_SUMMARY_TEMPLATE with 6 body variables: company, date, checked in, late, not in yet, on leave).
- Face match (Settings → Face match, per company): each check-in selfie is compared with the person's saved photo
  (first selfie with a face after it was turned on; admin can reset it in Staff). Default engine is free and runs on
  our server (`backend/lib/face-local.js`: @vladmandic/face-api on TensorFlow WASM, distance < 0.55 = match; models
  and .wasm bundled via `includeFiles` in vercel.json; check a deployment at `/api/face-selftest`). Set Vercel env
  FACE_PROVIDER=rekognition to use Amazon Rekognition CompareFaces in Mumbai instead (`backend/lib/face.js`,
  hand-signed SigV4, 90%+ = match; the AWS account must be on a paid plan, the Free plan denies Rekognition). Check-in and check-out selfies are both
  checked: a mismatch or no face is refused (422, code 'face', "try N of 3", nothing saved); the 3rd failed try in a
  row (within 30 min) goes through flagged and admins get a push. Review accounts are flagged, never refused; a
  Rekognition outage never blocks. Today shows In/Out results with a Compare view. Needs Vercel env REKOGNITION_ACCESS_KEY_ID and
  REKOGNITION_SECRET_ACCESS_KEY (IAM user allowed only rekognition:CompareFaces); Vercel reserves AWS_* names.
- Check-in: selfie + location (optional location lock per company). Leave requests, attendance correction requests,
  holidays, shifts, salary from attendance, pay adjustments (advance/bonus/deduction/addition), month close with
  snapshot, account deletion (switch off now, erase after 30 days by cron `/api/cron/erase-accounts`).
- Vercel env vars (values are secret, never print them): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AUTH_TOKEN_SECRET,
  RESEND_API_KEY, EMAIL_FROM, EMAIL_REPLY_TO, REVIEW_PHONE, REVIEW_CODE, CRON_SECRET, WHATSAPP_TOKEN,
  WHATSAPP_PHONE_ID, WHATSAPP_TEMPLATE, WHATSAPP_VERIFY_TOKEN, WHATSAPP_SUMMARY_TEMPLATE, REKOGNITION_ACCESS_KEY_ID, REKOGNITION_SECRET_ACCESS_KEY, FACE_PROVIDER (optional WHATSAPP_LANGUAGE, default `en`). After changing one, redeploy.

## Working rules
- Never print or commit secrets (keys, REVIEW_CODE, CRON_SECRET, keystores, google-services.json, service accounts).
- Do not modify the CRM (`peeenudotcom/tarahut-ams`); this app has its own backend.
- Work on a branch, open a PR, and merge to `main` only when the owner says "merge". Use full commit SHAs when merging.
- Don't commit an unrelated `package-lock.json` change from `npm install` on the Mac (`git checkout -- package-lock.json`).
- Explain things to the owner in plain language with exact click paths; they are not a developer.

## Commands (run in the project root)
- Backend tests: `cd backend && npm test` (in-memory fake Supabase; keep them passing).
- App locally: `npx expo start`.
- Builds: `eas build -p android --profile preview` (APK to share), `eas build -p android --profile production` (.aab
  for Play), `eas build -p ios --profile production`, then `eas submit -p ios --latest`.
- Instant JS fix to store apps (only for builds that include expo-updates): `eas update --channel production --message "..."`.
- Push App Store text: `REVIEW_CODE=xxxx eas metadata:push`.

## Open items (as of 20 Oct 2026)
1. Watch both store reviews; answer reviewer messages; keep demo accounts unchanged.
2. Main now has instant updates (Expo Updates). The next store builds (1.0.1) should be made from main so they can
   receive instant fixes; raise `version` in app.json for that release. `/android` (redirect in backend/vercel.json)
   points at the current preview APK: update it when a new preview build replaces it.
3. Optional: Firebase (`google-services.json` via EAS env) so Android receives push notifications.
4. Ideas parked: office Wi-Fi check-in (server checks request IP), company plans/billing (charge companies outside the
   app; no in-app purchases; never mention prices in the iOS app). Planned for 1.0.1: new layout (owner is planning
   it), then English/Punjabi/Hindi app screens (emails stay English), email optional when adding staff. The app parts
   of leave balance and My payslips are in the code and ship with 1.0.1.
6. Apple: replied to a Guideline 2.1 info request on 21 Oct with a screen recording; build 15 is back in review.
5. Duplicate "Vishu" staff entries in TARAhutAIBuilds (numbers ending 3184 and 4697): owner to switch one off.
