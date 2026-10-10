# App Store Connect listing: copy to paste

Product: **TARAhut Haazri** by TARAhut AI Builds. Home-screen label: **Haazri** (`expo.name` in `app.json`).

Everything below matches what build 7+ actually does. Paste each block into the matching field in
App Store Connect → TARAhut Attendance.

## App Information

| Field | Value |
| --- | --- |
| Name (30 max) | TARAhut Haazri |
| Subtitle (30 max) | Selfie & location attendance |
| Category | Business (secondary: Productivity) |
| Privacy Policy URL | https://haazri.tarahutaibuilds.com/privacy |
| Content rights | Does not contain third-party content |
| Age rating | Answer "None" to every question → 4+ |

## Version 1.0: description

**Promotional text** (170 chars max, can change without review):

> Mark attendance in seconds: take a selfie, confirm your location, done. Your admin sees who is in, when, and where.

**Description:**

> TARAhut Haazri makes daily check-in simple and honest for teams that work in offices, shops and on site.
>
> CHECK IN WITH A SELFIE
> Tap Check In, take a quick selfie and the app records the time and your current location. At the end of the day, check out the same way and your hours are worked out for you.
>
> SEE YOUR DAY AT A GLANCE
> The home screen shows whether you are checked in, when you started, where you checked in and, once you check out, the hours you worked.
>
> SIMPLE, SECURE SIGN-IN
> No passwords. Enter your phone number and we email you a one-time code. Your admin adds you to the team first, so only your own staff can sign in.
>
> BUILT FOR ADMINS TOO
> Admins can add staff members and review attendance, with the selfie and location for every check-in and check-out.
>
> PRIVATE BY DESIGN
> Your location is read only at the moment you check in or out, never in the background. Selfies are stored privately and shown only to your organisation's admins. No ads, no tracking.
>
> Each business gets its own private company space: staff see only their own company, and admins manage only their own team. Ask your admin to add you before you sign in.
>
> TARAhut Haazri is made by TARAhut AI Builds.

**Keywords** (100 chars max, comma-separated, no spaces):

> attendance,check in,selfie,staff,employee,timesheet,geo,location,workforce,team,hr,clock in,shift

**Support URL:** https://haazri.tarahutaibuilds.com/support
**Marketing URL:** leave empty (optional)
**Copyright:** 2026 TARAhut AI Builds

## App Review Information

| Field | Value |
| --- | --- |
| Sign-in required | Yes |
| User name | 9000000001 |
| Password | the REVIEW_CODE value (`REVIEW_CODE` in the tarahut-attendance Vercel project; given to the owner in chat, not stored in the repo) |
| Contact | the owner's name, phone and email |

**Notes** (paste, then put the code where it says CODE):

> Sign-in is by phone number and a one-time code. For review, use phone number 9000000001 and code CODE. This test account always accepts that code; no email is needed.
>
> After signing in, tap Check In. The app asks for camera permission (to take the check-in selfie) and location permission "while using the app" (to record where attendance was marked). Take the selfie, confirm, and you are checked in; the home screen then offers Check Out.
>
> Accounts are created by each organisation's admin, so there is no public sign-up and no in-app account deletion; staff ask their admin, or email privacy@tarahutaibuilds.com, to have their data deleted.

## App Privacy ("nutrition labels")

Answer **Yes, we collect data**. For every type below choose: **Linked to the user's identity: Yes**,
**Used for tracking: No**, **Purpose: App Functionality** only.

| Category | Data type | Why |
| --- | --- | --- |
| Contact Info | Name | Account |
| Contact Info | Email Address | Sign-in codes |
| Contact Info | Phone Number | Account and sign-in |
| Location | Precise Location | Recorded at check-in and check-out |
| User Content | Photos or Videos | Check-in and check-out selfies |
| Identifiers | User ID | Account ID behind the sign-in token |
| Other Data | Other Data Types | Check-in/out times and hours worked |

Do **not** declare: Browsing History, Search History, Purchases, Financial Info (the salary field is entered by
admins about staff and isn't collected from the device user), Health, Contacts, Usage Data, Diagnostics or Advertising
Data. Call history is read only by the Android app, so it is not declared for iOS.

## Screenshots (iPhone 6.9", 1320 × 2868)

Take them from the TestFlight build on an iPhone 15/16 Pro Max (or that simulator), signed in as the review account
so no real staff names appear:

1. Login screen with the phone number filled in
2. Home, not checked in
3. Check In camera with a selfie taken
4. Home, checked in (time and location)
5. Home, done for the day (hours)
