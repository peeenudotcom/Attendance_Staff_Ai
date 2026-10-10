# TARAhut Haazri logo

An "H" (for Haazri) whose crossbar is a tick (attendance marked). Design by the owner;
redrawn as clean vectors.

| Colour | Hex | Use |
| --- | --- | --- |
| Maroon | `#802534` | icon background; the H on light backgrounds |
| Cream | `#F4EFE7` | the H on the maroon icon |
| Teal | `#368A84` | the tick |

| File | Used for |
| --- | --- |
| `haazri-icon-square.svg` | iOS app icon source → `assets/icon.png` (1024, no transparency; iOS rounds the corners) |
| `haazri-icon-rounded.svg` | splash (`assets/splash-icon.png`), sign-in screen (`assets/logo.png`), favicons, website (`backend/public/logo.svg`) |
| `haazri-mark-android.svg` | Android adaptive icon foreground → `assets/adaptive-icon.png` (background colour `#802534` in `app.json`) |
| `haazri-mark-on-light.svg` | maroon H + teal tick for white backgrounds (documents, website, print) |

The PNGs were rendered from these SVGs with headless Chromium at the listed sizes.
