# Fixing the app after release (instant updates)

The app has Expo Updates built in (from version 1.0.0 builds made after 20 Oct 2026). Fixes to the app's own
screens and logic can be sent straight to phones, without a new store review.

## Which fixes go out instantly

| Change | How it ships |
| --- | --- |
| Server, dashboard, emails, reports, salary rules | Merge to main: Vercel deploys in a minute. Nothing for users to update. |
| App screens, wording, layout, app-side logic (JavaScript) | **Instant update** (below). Users get it the next time they reopen the app. |
| New permissions, new native libraries, new app icon/splash, a new Expo SDK | New store build and review. Change `version` in `app.json` too (see "Runtime version"). |

## Publishing an instant update (Mac, in the project folder)

```
git checkout main && git pull
eas update --channel production --message "Fix: <what was fixed>"
```

- `production` reaches phones installed from the App Store and Google Play.
- `preview` reaches the APK shared directly with staff: `eas update --channel preview --message "..."`.
  Run both if both kinds of install are in use.
- Phones download the update in the background when the app opens and switch to it the next time the app
  is opened (or after it is closed from the app switcher).

**Undo a bad update:** expo.dev, then the project, then **Updates**, then the update, then **Roll back**. Or run
`eas update:rollback` and follow the prompts.

## Runtime version

`runtimeVersion` follows the app `version` in `app.json` (now 1.0.0). An update only reaches builds with the same
version. After changing anything native (see the table), raise `version` (for example to 1.0.1) and make new store
builds; updates published after that go to the new builds only.

## Store rules

Both stores allow this for bug fixes and improvements. Do not use it to add features that change what the app is
for, or to get around review: those still need a normal store update.
