# TARAhut Attendance — App Store release guide

This branch makes the app buildable and submittable to the App Store with EAS (Expo Application Services).
Everything that can be done inside the repository is done; the remaining steps need your Apple account
and your Expo account, so they run from your Mac.

## 1. What is already in place

| Item | Value / location |
| --- | --- |
| Expo SDK / React Native | 54 / 0.81, New Architecture on, Hermes |
| Display name | `TARAhut Attendance` (`expo.name` in `app.json`; iOS truncates long labels under the icon, shorten if you prefer) |
| Bundle identifier | `com.tarahut.attendance` (`expo.ios.bundleIdentifier`) |
| Android package | `com.tarahut.attendance` (ready for Play later) |
| Version / build | `1.0.0` / build `1`; EAS auto-increments the build number (`appVersionSource: remote`) |
| Device family | iPhone only (`supportsTablet: false`), so iPad screenshots are not required |
| Permission strings | Camera, Location (when in use), Photo library — specific text set via plugins in `app.json` |
| Export compliance | `ITSAppUsesNonExemptEncryption = false` (HTTPS only), so TestFlight will not ask on every build |
| Icon / splash | Generated from the app's brand colors in `assets/`; replace with official artwork any time (1024x1024 PNG, no transparency for `icon.png`) |
| EAS profiles | `eas.json`: `preview` (internal install on registered devices) and `production` (App Store) |

Verified in this branch: `expo-doctor` passes every offline check, `expo export --platform ios` bundles cleanly,
and `expo prebuild` for iOS and Android generates the expected Info.plist, icon set, splash and manifest.

## 2. One-time setup on your Mac

1. Enroll in the Apple Developer Program (USD 99/year) at https://developer.apple.com/programs/ with the Apple ID that will own the app.
2. Install and sign in to EAS:

```bash
npm install -g eas-cli
eas login            # your Expo account (free tier is fine)
cd Attendance_Staff_Ai
npm install
eas init             # links the repo to an EAS project and writes extra.eas.projectId into app.json
git add app.json && git commit -m "Link EAS project"
```

## 3. First App Store build

```bash
eas build --platform ios --profile production
```

The first run prompts for:
- Your Apple ID. EAS then registers the bundle ID `com.tarahut.attendance`, and creates the distribution certificate and provisioning profile for you.
- The initial build number (because versions are managed remotely). Accept `1`.

The build runs on EAS servers (about 15 to 25 minutes). You can watch it at https://expo.dev.

## 4. Upload to App Store Connect / TestFlight

```bash
eas submit --platform ios --latest
```

EAS can create the App Store Connect record for you when asked (name: TARAhut Attendance, SKU: tarahut-attendance,
primary language: English (India) or English (US)). The build appears under TestFlight within 10 to 30 minutes.
Install it on a real iPhone from TestFlight and run through check-in, check-out, gallery upload and sign-out
before submitting for review.

To hand out test builds without TestFlight: `eas build --platform ios --profile preview` and register tester
devices with `eas device:create`.

## 5. App Store Connect listing checklist

- **Name**: TARAhut Attendance. **Subtitle**: e.g. "Selfie and GPS attendance for teams". **Category**: Business.
- **Screenshots**: iPhone 6.9" (1320 x 2868) is mandatory; 6.5" (1284 x 2778) is optional but recommended. Take them from the TestFlight build on an iPhone 16 Pro Max / 15 Pro Max or the simulator. No iPad set is needed.
- **Privacy policy URL** (required): host a page that covers phone number, name, selfie photos, precise location at check-in/out, and any call-log data on Android. A page on tarahut.com works.
- **App Privacy (nutrition labels)**: declare at least Name, Phone Number, Precise Location, Photos (selfie), and User ID (auth token), all "linked to the user" and used for App Functionality. Say "No" to tracking.
- **Age rating**: 4+. **Copyright**: TARAhut AI Labs.
- **App Review Information**: give a working sign-in. Sign-in now goes through the backend only, so create a reviewer account on `tarahut-ams` whose OTP is fixed or forwarded to you, and put that phone number and OTP in the review notes. Explain why camera and location are needed (the check-in selfie and work-site location).
- **Sign in with Apple** is not required because the only login is first-party phone OTP.

## 6. Gaps a reviewer may notice (fix before or soon after v1.0)

Honest status: the store build now contains only screens that work against the backend or the device; the
sample-data screens are hidden (item 3) until they are wired up. Apple's reviewers test the app by hand, so the items below are ordered by how
likely they are to cause a rejection under Guideline 2.1 (completeness) and 2.3 (accurate metadata).

1. **Demo sign-in fallback.** Removed in this branch: sign-in now fails visibly when the backend rejects the
   OTP or is unreachable, and the Admin/Staff picker that only fed the demo profile is gone (the role comes from
   the backend user). Reviewers therefore need a real account on the backend; see section 5.
2. **Face verification.** Resolved by renaming the feature to what it is: a selfie check-in. The simulated
   "detecting face" and "92 to 99 percent match" steps are gone; the flow is capture, preview, confirm, and the
   selfie is stored with the attendance record. Describe it as a selfie check-in in the listing.
3. **Sample data and inert controls.** Hidden from the store build behind `SHOW_SAMPLE_DATA` in
   `src/config/features.js` (false by default): the History tab, Reports, Leave, Payroll/Salary, Live Track, the
   chat assistant, Notifications, and the sample sections on Home (score, insights, briefing, predictions, team
   activity, Command Center values) and Profile (stats). What ships is sign-in, selfie check-in/out, Gallery,
   Add Staff (admin), Calls (Android, real device logs) and Profile. Flip the flag for demos; when a screen is
   wired to the API, remove its gate rather than keeping it behind the flag.
4. **Status bar and keyboard on current iPhones.** Fixed in this branch: every screen now pads its header
   from the device safe-area inset (via the hooks in `src/utils/safeArea.js`), the tab bar and floating assistant
   button follow the home-indicator inset, the Leave and Add Staff forms avoid the keyboard, and Reports has a back
   button. Still check each screen once on a Dynamic Island iPhone and an iPhone SE in TestFlight.
5. **Role checks.** Resolved: Payroll/Salary, Add Staff and Live Track are registered in the navigator only for
   admins, the Salary shortcut is admin-only, and the chat assistant refuses admin intents (leave decisions,
   reminders, scheduling, WhatsApp, payroll) for staff accounts. Reports and Leave stay available to staff and
   already show role-appropriate content.
6. **Personal data in the source.** Resolved: `src/data/mockData.js` now uses placeholder people and neutral
   leave reasons, and `ProfileScreen` no longer falls back to a real-looking phone number. The sample names in
   the Home, Payroll, Live Track and Call Logs screens are fictional and go away when those screens are wired
   to the API.
7. **Account deletion** (Guideline 5.1.1 v) is not required while accounts are created by an admin rather than
   in the app. If you ever add self sign-up, an in-app delete option becomes mandatory.
8. **Android call logs.** The Calls tab and Home shortcut are now Android-only. Google Play restricts the
   `READ_CALL_LOG` permission to default phone/assistant apps, so expect a Play policy review there later.

## 7. Backend

The app talks to `https://tarahut-ams.vercel.app/api` (`src/services/api.js`): auth (login, verify-otp, profile),
attendance (check-in, check-out, history, today, approve, reject), staff (list, detail, and `POST /staff` to create,
which the Add Staff form now relies on), and call-log sync. The `tarahut-ams`
project exists in your Vercel team, but its deployment status could not be read from this environment, so confirm
the production deployment is live and the OTP flow works end to end before review. All traffic is HTTPS,
which is what the encryption declaration above relies on.

## 8. After approval

- Bump `expo.version` in `app.json` for each store release; build numbers increment automatically.
- Keep `com.tarahut.attendance` and the EAS project ID unchanged, or the app becomes a different app to Apple.
