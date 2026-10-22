# Handoff: where the work stands (22 Oct 2026)

Read `CLAUDE.md` first for the full picture. This file is the short "what's happening now" list.

## Just finished (all merged to `main`)
- PR #38: light Apple-style "glass" look (owner chose "Full light Apple style", based on an Airtel app screenshot).
  Soft grey page `#EEF1F6`, white rounded cards, navy `#13213D` buttons, yellow `#F6CF4C` highlight, floating
  frosted-glass tab bar (`src/navigation/AppNavigator.js`, `expo-blur` on iOS, near-white on Android/web).
  Check-in screen fits on one screen: compact address line above the camera, camera at most 36% of the screen height.
- PR #36/#37: smaller fonts (`maxFontSizeMultiplier` 1.2 in `App.js`), check-in opens full screen.
- Earlier: new layout from the owner's mockups, English/Punjabi/Hindi app screens, face match (free local engine by
  default), overtime, paid leave balance, payslips, daily WhatsApp summary, WhatsApp sign-in codes, self sign-up.

## How the owner sees app changes
- Store 1.0 builds (iOS build 15, Android versionCode 7) are in review and do NOT have instant updates; they show the
  old UI.
- The owner's TestFlight build 16 and the Android preview APK DO have instant updates. To publish the latest app code:
  `git checkout main && git pull && eas update --channel production --message "..."` (and `--channel preview` for the
  APK). Then close and reopen the app twice.
- Last step given to the owner: publish "Light glass look" with the command above and send screenshots of anything
  that looks wrong. Waiting on that feedback.

## Next, in order
1. Fix whatever the owner reports from testing the glass look (send them exact steps to re-publish afterwards).
2. Watch both store reviews (Apple build 15 is back in review after the 21 Oct reply). Keep the demo accounts as they
   are.
3. After both stores approve 1.0: release 1.0.1 from `main` (raise `version` in `app.json`; this also changes the
   Expo Updates runtime version, so 1.0.1 builds only receive updates published after they are built). If a new
   preview APK is made, point the `/android` redirect in `backend/vercel.json` at it.
4. Make email optional when an admin adds staff (app `AddStaffScreen` + dashboard + `backend/api/staff`). Planned for
   1.0.1.
5. Get a native speaker to check the Punjabi and Hindi strings in `src/i18n/strings/`.

## Waiting on the owner (nothing to code)
- Face match: turn it on for TARAhutAIBuilds (dashboard Settings → Face match), reset saved photos in Staff, test.
- Daily WhatsApp summary: create a Utility template with 6 body variables in Meta and set
  `WHATSAPP_SUMMARY_TEMPLATE` in Vercel, then redeploy.
- Switch off one of the duplicate "Vishu" staff entries in TARAhutAIBuilds.
- Optional: Firebase `google-services.json` via EAS env for Android push.
- Optional (asked, no answer yet): move the web dashboard and app icon from maroon to the new navy/yellow look.

## Useful checks
- Backend tests: `cd backend && npm test` (13 tests, in-memory fake Supabase).
- Face engine on a deployment: `/api/face-selftest`.
- Logs: Vercel project `prj_HQyVSlkBNdD1HgZAV4icCMrHhMJB` (runtime logs), Supabase project `oilkvoexlvhkjthpvgfr`.
- Web preview of the app: `npx expo start --web` (some screens need a real phone: camera, location, push).
