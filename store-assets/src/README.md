# SyndicUp store screenshots (FR + AR)

Reproducible, code-rendered App Store and Google Play screenshots. **No edits under apps/**.

## Generate

From the repository root:

```sh
python -m pip install pillow playwright
python -m playwright install chromium
python store-assets/src/render.py
```

The source reads the actual Flutter fonts from `apps/mobile/assets/fonts/`, the original Dari PNGs from `apps/mobile/assets/dari/`, repository building photos, the brand SVG symbol, and UI labels from `apps/mobile/lib/core/i18n/fr.arb` and `ar.arb`. Screens and hierarchy are derived from Flutter widget code. The same fictional Résidence Al Amal data is used in every format.

Each of the eight formats has its own generated, editable HTML source in `store-assets/src/templates/`. The script converts screenshots to 8-bit opaque RGB PNG with sRGB profile and verifies their IHDR dimensions. Results are in `store-assets/play/` and `store-assets/appstore/`. The verified manifest is `store-assets/CHECKLIST.md`. Phone contact sheet: `store-assets/contact-sheet.png`.

Existing PNGs with valid dimensions are skipped. To fully regenerate after changing HTML, brand assets, or dictionaries:

```sh
find store-assets/play store-assets/appstore -type f -name '*.png' -delete
python store-assets/src/render.py
```

## Known UI reconstructions vs Flutter

These are **HTML/CSS reproductions**, not literal pixels captured from a running Flutter emulator. The backend is not contacted and all amounts, names and dates are demo data.

- **01 Dashboard** — `features/dashboard/dashboard_screen.dart`: syndic role, with greeting, Dari, Wise tiles, quick actions and funding section. The live onboarding and some dynamic dashboard content are omitted and the Dari dashboard card is simplified.
- **02 Finances** — `features/finances/finances_screens.dart`: `AppelDetailScreen` amount summary, payment tiles, detail-per-lot list; all amounts fictional.
- **03 Incidents** — `features/incidents/incidents_screens.dart`: filter chips, list rows, urgency/status pills, with two incidents. The separate incident-detail route is not superimposed on the list.
- **04 AG** — `features/ag/ag_screens.dart`, `features/ag/ag_seance_screen.dart`: AG detail and live-session entry; ballot controls live in the separate meeting route. No fictitious voting buttons.
- **05 Announcements** — `features/communication/communication_screens.dart`: filter pills, ink pinned `PosterCard`, and `AnnonceCard`.
- **06 Documents** — `features/documents/documents_screen.dart`: existing photo banner, greige search pill, document-type pills and rows.
- **07 Visitors/parking** — `features/parkings/parkings_screens.dart`, `features/visites/visites_screens.dart`: actual visitors tab of Parkings. Visiting approvals live on their own screen.
- **08 Dari** — `features/assistant/assistant_screen.dart`, `features/assistant/dari.dart`: original, unmodified Dari poster PNG in green header, chat cards, suggestions and input.

SVG glyphs approximate existing Material icons but do not imply extra features. Keep this list in sync with renderer changes.
