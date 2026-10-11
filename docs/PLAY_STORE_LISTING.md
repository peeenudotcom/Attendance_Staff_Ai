# Google Play: setup, listing and Data safety

Package name: **com.tarahut.attendance** · App name: **TARAhut Haazri** · Home-screen label: **Haazri**

## 1. Try it on an Android phone first (no Play account needed)

On the Mac, in the project folder:

```
git checkout main && git pull && npm install
eas build --platform android --profile preview
```

When it finishes (about 10–15 minutes) EAS prints a link and a QR code. Open it on an Android phone, download the
APK and install it (Android asks to allow installs from the browser once). The first Android build asks to create an
Android signing key: answer **Yes** (EAS keeps it; every later build and the Play Store use the same key).

## 2. Google Play developer account

Play Console: <https://play.google.com/console/signup> · one-time fee **$25**.

| Account type | What you need | What it means |
| --- | --- | --- |
| **Personal** | Your ID, phone, a card | Quick to open. New personal accounts must run a **closed test with at least 12 testers for 14 days** before the app can go public. Your own staff and a pilot client's staff can be those testers |
| **Organisation** (chosen) | A free **D-U-N-S number** in the legal name **Sukhija Technoaid** (proprietorship; trade name TARAhut AI Builds; takes 1–2 weeks) | Public developer name can be "TARAhut AI Builds"; Google may show the legal name and address under "About the developer"; no 12-tester rule |

Google shows the current rules when you sign up; follow what Play Console says if they differ from the above.

## 3. Create the app

Use the legal name **Sukhija Technoaid** and its registered address and phone exactly as on the D-U-N-S record when signing up;
set the public **Developer name** to *TARAhut AI Builds* in Play Console → Settings → Developer account.

Play Console → **Create app** → name *TARAhut Haazri*, default language *English (India)*, **App**, **Free**, accept
the declarations. Then fill in each section under **Dashboard → Set up your app**:

### Store listing

| Field | Value |
| --- | --- |
| App name (30) | TARAhut Haazri |
| Short description (80) | Selfie & location attendance with leave, shifts and salary for your team |
| App icon | `assets/store/play-icon-512.png` (512 × 512) |
| Feature graphic | `assets/store/play-feature-graphic.png` (1024 × 500) |
| Phone screenshots | 2–8 screenshots from the APK (sign in with the review account so no real names show): Login, Home, Check In, My attendance, Leave, Team |
| Category | Business |
| Contact email | support@tarahutaibuilds.com |
| Website | https://haazri.tarahutaibuilds.com |
| Privacy policy | https://haazri.tarahutaibuilds.com/privacy |

**Full description:**

> TARAhut Haazri makes daily attendance simple and honest for teams in offices, shops and on site.
>
> CHECK IN WITH A SELFIE
> Tap Check In, take a quick selfie and the app records the time and your location. Check out the same way and your hours are worked out for you. If your company uses location lock, you can only check in at the office.
>
> SEE YOUR MONTH
> A calendar shows every day: present, late, half day, leave, holiday or absent, with your in and out times.
>
> LEAVE IN A FEW TAPS
> Ask for leave from the app and get notified when your admin approves it.
>
> REMINDERS
> A reminder if you haven't checked in by your start time, and one to check out at the end of your shift.
>
> FOR ADMINS
> See who is in, late or absent with selfies and locations, approve leave, fix a missed check-in, and manage staff. The web dashboard adds monthly sheets, salary from attendance, shifts, holidays and Excel downloads.
>
> PRIVATE BY DESIGN
> Location is read only when you check in or out, never in the background. Selfies are stored privately and shown only to your company's admins. No ads, no tracking.
>
> Your company's admin adds you first; then sign in with your phone number and a code sent to your email.

### App access

**All or some functionality is restricted** → add instructions:

> Sign-in is by phone number and a one-time code. Use phone number 9000000001 and code CODE (this test account always accepts that code; no email is needed). It is a staff account in a demo company.

Put the real code (`REVIEW_CODE` in the Vercel project) in place of CODE; it is the same one given to Apple.

### Ads

**No**, the app has no ads.

### Content rating

Start the questionnaire: category **Utility, productivity, communication or other**; answer **No** to every
question (no violence, sexuality, gambling, user-to-user chat, etc.). Result: rated for everyone.

### Target audience

**18 and over** only. Not designed for children.

### Data safety

Does the app collect or share user data? **Yes**. Is all data encrypted in transit? **Yes**. Can users request
deletion? **Yes** (by email to privacy@tarahutaibuilds.com or through their admin). Shared with third parties? **No**
(service providers acting for us don't count as sharing).

| Data type | Collected | Optional? | Purposes |
| --- | --- | --- | --- |
| Personal info → Name | Yes | Required | App functionality, Account management |
| Personal info → Email address | Yes | Required | App functionality, Account management |
| Personal info → Phone number | Yes | Required | App functionality, Account management |
| Personal info → User IDs | Yes | Required | App functionality, Account management |
| Location → Precise location | Yes | Required | App functionality |
| Photos and videos → Photos | Yes | Required | App functionality |
| App activity → Other user-generated content (leave requests) | Yes | Optional | App functionality |
| Device or other IDs (notification token) | Yes | Optional | App functionality |

Not collected: financial info, health, messages, contacts, call logs, web history, audio, files, calendar, app
interactions/analytics, crash logs.

### Permissions

The app asks only for camera, precise location (while using the app) and notifications. No background location and
no call-log or SMS permissions, so no permission declaration forms are needed.

## 4. Upload the first release

```
eas build --platform android --profile production
```

This makes an `.aab` file. In Play Console → **Testing → Internal testing** (or **Closed testing** for the 12-tester
rule) → **Create new release** → upload the `.aab` from the EAS build page → add testers' Gmail addresses → roll out.
Google requires the first upload to be done by hand; later builds can be uploaded automatically with
`eas submit --platform android` once a Play service-account key is set up.

## 5. Notifications on Android

Reminders work without any setup. Push messages (leave requested / approved) on Android need Firebase:

1. <https://console.firebase.google.com> → **Add project** "Haazri" (Analytics off).
2. **Add app → Android**, package `com.tarahut.attendance` → download **google-services.json**.
3. Put the file in the project root and add `"googleServicesFile": "./google-services.json"` under `android` in `app.json`
   (or send it to Claude to do).
4. Firebase → Project settings → **Service accounts** → **Generate new private key**, then on the Mac:
   `eas credentials` → Android → production → **Google Service Account → FCM V1** → upload that key.
5. Build again.
