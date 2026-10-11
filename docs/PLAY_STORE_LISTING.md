# Google Play: build, listing, Data safety and review

Developer account: **Organisation**, legal name **SUKHIJA TECHNO AID** (public developer name: *TARAhut AI Builds*),
owner account tarahutAIBuilds@gmail.com. Website tarahutaibuilds.com (verified).

| | |
| --- | --- |
| Package name (final, can never change) | **com.tarahut.attendance** |
| App name on Play | **TARAhut Haazri: Attendance** (or just *TARAhut Haazri*) |
| Home-screen label | Haazri |
| Version | `version` in `app.json` (now **1.0.0**) is the name users see; the **versionCode** is kept by EAS and goes up by one on every production build |
| Target / compile / min SDK | **36 / 36 / 24** (Expo SDK 54, React Native 0.81). Play requires API 36 for new apps from 31 Aug 2026 |
| 16 KB memory pages | Supported (React Native 0.81) |

## 1. Build the release bundle (.aab)

On the Mac, in the project folder:

```
git checkout main && git pull && npm install
eas build --platform android --profile production
```

The `production` profile makes an **app bundle** and increases the versionCode itself. When it finishes (about
15 minutes), download the `.aab` from the build page on expo.dev. Nothing is uploaded to Google by this command.

**Signing.** EAS created the Android upload key during the first (preview) build and keeps it on Expo's servers. It is
never in this repository (`.gitignore` blocks `*.jks`, `*.keystore`, `credentials.json`, service-account keys and
`google-services.json`). When you create the app in Play Console, keep **Play App Signing** on (the default): Google
holds the key that signs what users install, and the EAS key is only the *upload* key. If the upload key is ever
lost, Google can reset it. To back it up: `eas credentials` → Android → production → **Download credentials**, and
store the file in a password manager, not in git.

**Before the first production build (one-off checks):**

- `eas credentials` → Android → production should show the same keystore the preview APK used.
- Optional, for push messages on Android: Firebase (section 8). Without it the app works and on-phone reminders
  still fire; only "leave requested / approved" pushes don't reach Android phones.

## 2. Create the app in Play Console (once verification is approved)

**Create app** → name *TARAhut Haazri: Attendance* → default language **English (India) – en-IN** → **App** →
**Free** → accept the declarations. Then fill in each section under **Dashboard → Set up your app**.

## 3. Store listing

| Field | Value | Limit |
| --- | --- | --- |
| App name | TARAhut Haazri: Attendance | 30 |
| Short description | Selfie and location attendance, leave and reminders for your team | 80 (65 used) |
| App icon | `assets/store/play-icon-512.png` (512 × 512, 32-bit PNG) | |
| Feature graphic | `assets/store/play-feature-graphic.png` (1024 × 500) | |
| Phone screenshots | `assets/store/screenshots/01…07` (1080 × 1920, demo company, fictional names) | 2–8 |
| App category | **Business** | |
| Tags | Attendance, Business, Productivity | |
| Email | support@tarahutaibuilds.com | |
| Website | https://tarahutaibuilds.com | |
| Phone | optional; if given, it's public | |
| Privacy policy | https://haazri.tarahutaibuilds.com/privacy | |

Screenshot order: 01 Home (checked in) · 02 Check in with a selfie · 03 My attendance calendar · 04 Ask for leave ·
05 Team today (admin) · 06 Approve leave (admin) · 07 Staff (admin). They were taken from the app's own screens
running on demo data. You can swap in shots from a real Android phone later (signed in with the review accounts) at any time.

**Full description** (paste as is):

> TARAhut Haazri makes daily attendance simple and honest for teams in offices, shops and on site.
>
> CHECK IN WITH A SELFIE
> Tap Check In, take a quick selfie and the app records the time and where you are. Check out the same way and your hours are worked out for you. If your company uses location lock, you can only check in at the workplace.
>
> SEE YOUR MONTH
> A calendar shows every day: present, late, half day, leave, holiday or absent, with your in and out times.
>
> LEAVE IN A FEW TAPS
> Ask for leave from the app and get notified when your admin approves it.
>
> REMINDERS
> A reminder if you haven't checked in by your start time, and one to check out at the end of your shift. Weekly offs, holidays and approved leave are skipped.
>
> FOR ADMINS
> See who is in, late or absent today with selfies, approve leave, add a day for someone who missed check-in, and manage staff. The web dashboard adds monthly sheets, salary from attendance, shifts, holidays and Excel downloads.
>
> PRIVATE BY DESIGN
> Location is read only when you check in or out, never in the background. Selfies are stored privately and shown only to your company's admins. No ads, no tracking, no in-app purchases. You can delete your account from the app at any time.
>
> Haazri is for companies that use TARAhut Haazri. Your company's admin adds you first; then sign in with your phone number and a code sent to your email.

**Release notes** (for the first release, "en-IN"):

```
First release of TARAhut Haazri:
• Check in and out with a selfie and your location
• Your attendance calendar with times, leave and holidays
• Ask for leave and get notified when it's decided
• Check-in and check-out reminders
• For admins: team today, leave approvals, missed check-ins and staff
• Delete your account from the app (You → Delete my account)
```

## 4. App content (Policy → App content)

### Privacy policy
https://haazri.tarahutaibuilds.com/privacy

### App access
**All or some functionality is restricted** → add two sets of instructions:

| Name | Username / phone | Password / code | Notes |
| --- | --- | --- | --- |
| Staff demo | 9000000001 | *REVIEW_CODE* | Enter the phone number, tap Continue, enter the 4-digit code, tap Verify |
| Admin demo | 9000000002 | *REVIEW_CODE* | Same steps; shows Team today, leave approvals and Staff |

Instructions text:

> Sign-in is by phone number and a one-time code (normally emailed). These two demo accounts always accept the code CODE and need no email. They belong to a demo company with no location lock, so check-in works anywhere. Check In asks for camera and location permission, takes a selfie and records attendance. You → Delete my account shows the account-deletion flow; the demo accounts stay active for other reviewers, so a real account is switched off at that point.

Replace CODE with the real `REVIEW_CODE` from Vercel (the same code Apple has). Before submitting, run
`docs/review-demo-accounts.sql` once and set `REVIEW_PHONE` to `9000000001,9000000002` in Vercel.

### Ads
**No**, the app contains no ads.

### Content rating (IARC questionnaire)
- Email: support@tarahutaibuilds.com · Category: **All other app types** (utility, productivity, business).
- Violence, fear, sexuality, language, controlled substances, crude humour, gambling: **No** to all.
- Does the app let users interact or exchange content? **No.** There is no chat, messaging, public posting or
  user-to-user media. Leave requests and selfies go only to the person's employer.
- Does the app share the user's current physical location with other users? **Yes.** The check-in location is
  shown to the company's admins.
- Does the app allow purchase of digital goods? **No.** Is it a web browser or search engine? **No.**
- Expected result: rated for everyone (3+ / Everyone), possibly with a "Shares location" notice.

### Target audience and content
Age groups: **18 and over** only. The app does not appeal to children. Not in Designed for Families.

### News app: **No**. COVID-19 contact tracing/status: **No**. Government app: **No**.
### Financial features: **None** (the salary figures on the web dashboard are payroll records, not financial services).
### Health: **No** health features.
### Advertising ID: **No**, the app doesn't use it (the `AD_ID` permission is blocked in `app.json`).

### Data safety

Overview answers:

| Question | Answer |
| --- | --- |
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (HTTPS only) |
| Which account creation methods does your app support? | **Username and other authentication** (phone number + one-time code). Admins create accounts for their staff in the app, so answer as an app that supports account creation. If asked to describe: "The company's admin adds each person; they sign in with their phone number and a one-time code." |
| Do you provide a way for users to request that their data is deleted? | **Yes** |
| Delete account URL | https://haazri.tarahutaibuilds.com/delete-account |
| Data shared with third parties? | **No** (Supabase, Vercel, Resend, Expo and Google process data for us as service providers, which Play does not count as sharing) |

Data types (all **collected**, none **shared**, none processed ephemerally unless noted; "Required" means the
user can't turn it off):

| Category → type | Required? | Purposes |
| --- | --- | --- |
| Location → **Precise location** | Required (to check in) | App functionality |
| Location → Approximate location | not collected separately (precise covers it) | |
| Personal info → **Name** | Required | App functionality, Account management |
| Personal info → **Email address** | Required | App functionality, Account management |
| Personal info → **Phone number** | Required | App functionality, Account management |
| Personal info → **User IDs** | Required | App functionality, Account management |
| Personal info → **Other info** (designation, department) | Optional | App functionality |
| Financial info → **Other financial info** (salary type and amount, entered by the admin) | Optional | App functionality |
| Photos and videos → **Photos** (check-in selfies) | Required | App functionality, Fraud prevention, security and compliance |
| App activity → **Other user-generated content** (leave reasons) | Optional | App functionality |
| App activity → **Other actions** (check-in and check-out times) | Required | App functionality |
| Device or other IDs → **Device or other IDs** (notification token) | Optional | App functionality |

Not collected: messages, contacts, call logs, calendar, files and docs, audio, health and fitness, web browsing,
installed apps, search history, app interactions/analytics, crash logs, diagnostics, advertising ID,
purchase history, credit card or bank details.

### Permissions (what the app bundle asks for)
Camera, fine and coarse location (only while the app is open), notifications, vibrate, run at boot (to keep
scheduled reminders after a restart), internet. **No** background location, call log, SMS, phone state,
microphone, contacts, storage, photo library, exact alarms, foreground service or advertising ID, so **no**
permission declaration forms are needed. (The call-log module is left out of the Android build by
`react-native.config.js`; `app.json` blocks the other permissions.)

## 5. First upload (when you decide to)

Play Console → **Testing → Internal testing** → **Create new release** → upload the `.aab` → paste the release notes
→ add testers (an email list) → **Save** → review → roll out to internal testers. Google requires the very first
`.aab` to be uploaded by hand. After that, `eas submit --platform android` can upload builds (track `internal`, as a
draft, set in `eas.json`) once a Play service-account key is added in `eas credentials`.

When internal testing looks good: **Production → Create new release** → promote the same build → **Send for review**.
Organisation accounts don't need the 12-tester closed test that new personal accounts need.

## 6. Account deletion (Play requirement)

- In the app: **You → Delete my account** → confirm. The account is switched off and signed out at once.
- On the web: https://haazri.tarahutaibuilds.com/delete-account (steps + email route).
- TARAhut support (support@tarahutaibuilds.com) and the company's admins get an email; the person gets a confirmation.
- After 30 days the daily job erases name, phone, email, selfies (files), locations and leave reasons; the employer keeps
  the dates and hours, without the name, for payroll. Needs migration `011_account_deletion.sql` and `CRON_SECRET` in Vercel.

## 7. Before you submit: checklist

- [ ] Migration `backend/supabase/migrations/011_account_deletion.sql` applied
- [ ] `CRON_SECRET` set in Vercel (any long random string) so the erase job runs
- [ ] `docs/review-demo-accounts.sql` run and `REVIEW_PHONE` = `9000000001,9000000002` in Vercel
- [ ] support@tarahutaibuilds.com receives mail (deletion notices and the public contact go there)
- [ ] Production `.aab` built with `eas build -p android --profile production`
- [ ] Installed on a real Android phone (internal testing): sign in, check in, check out, leave, delete-account dialog
- [ ] Store listing, App content and Data safety filled in from this page

## 8. Push notifications on Android (optional, recommended)

1. <https://console.firebase.google.com> → **Add project** "Haazri" (Google Analytics **off**).
2. **Add app → Android**, package `com.tarahut.attendance` → download **google-services.json**. Keep it out of git.
3. On the Mac: `eas env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --environment production --environment preview --visibility sensitive`
   (`app.config.js` reads it at build time).
4. Firebase → Project settings → **Service accounts** → **Generate new private key**, then
   `eas credentials` → Android → production → **Google Service Account → FCM V1** → upload that key. Delete the key file afterwards.
5. Build again. Firebase Cloud Messaging only delivers the notifications; it adds no new data types to Data safety
   (the notification token is already declared).
