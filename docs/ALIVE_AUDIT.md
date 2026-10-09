# ALIVE_AUDIT — Phase 0 (audit, no code)

Date: 2026-10-08 · Scope: `apps/mobile` (Flutter) and `apps/web` (Next.js 15) · Status: **awaiting approval**

This audit maps the "Alive" brief onto the real stack. The brief assumes React Native
(Reanimated, Pressable). SyndicUp is **Flutter + Next.js**, and both clients **already ship a
motion layer** (branch `feature/motion-premium-polish`, 2026-10-01). So Alive extends that layer.
It does not start over.

---

## 1. Stack detected

| | Mobile | Web |
|---|---|---|
| Framework | Flutter 3 (Dart ^3.7), Riverpod, go_router 14 | Next.js 15 App Router, React 19, Tailwind 4, server actions (`useActionState` ×219) |
| Animation | `flutter_animate` 4.5 + hand-made controllers; tokens in `lib/core/theme/motion.dart` (`SuMotion`) | `app/motion.css` (483 lines, CSS-first) + `motion` v12 (LazyMotion strict, **shell only** via ESLint) |
| Haptics | `HapticFeedback` (5 raw calls, no service) | none (`navigator.vibrate` unused) |
| Audio | none (push-notification sound only) | none |
| Realtime | SSE `GET /notifications/stream` (`core/realtime/notifications_live.dart`), AG session polled every 5 s | same SSE through `/api/notifications-stream` (`components/shell/live.tsx`), 15 s polling fallback, `router.refresh()` every 25 s + on tab focus |
| Offline | Drift queues: visits, LCD, attendance, tasks (gardien only; **never finances**, Master Spec 13.3) | none |
| Feature flags | none (dart-defines only) | none |
| Lint | stock `flutter_lints`, no custom rules | ESLint `no-restricted-imports` keeps `motion` inside `components/shell` |
| Reduce motion | honoured (`SuMotion.reduced`, `Animate.defaultDuration = 0`) | honoured (global CSS override + `MotionConfig reducedMotion="user"`) |
| RTL | `SuMotion.sign(ctx)`, shimmer and charts mirrored | `--dir` CSS variable, `useDirSign()` |

**What changes from the brief because of this stack**
- "Reanimated worklets / UI thread": in Flutter, animations run on the raster thread as long as
  we animate `Transform` / `Opacity` / `FadeTransition` / `ScaleTransition` and avoid animating
  layout (`AnimatedContainer` size, `AnimatedSize` on long lists). On web, only `transform` /
  `opacity` in CSS or WAAPI.
- "Pressable / Touchable": these are `InkWell`, `GestureDetector`, `*Button` on mobile, and
  `<button>`, `<a>`, `<Link>` on web.
- iOS haptics on the **web** do not exist (Safari has no Vibration API). Web haptics only work on
  Android Chrome. That is a platform limit, not a gap.

## 2. Inventory

### 2.1 Screens
- **Mobile: 74 screens** (75 `GoRoute`s; `LotFormScreen` serves 2). Auth and boot 11, onboarding 1,
  dashboard 1 (4 role variants), syndic/management ≈40, résident ≈8, gardien 3, profile and misc 5.
  14 tab roots.
- **Web: 93 pages** (`page.tsx`). Public/auth 9, super-admin 3, back-office ≈70 (shared by
  syndic, conseil, résident, gardien; filtered by `buildNav(role)`), settings 2. Also 89
  `loading.tsx` files.

### 2.2 Components (counts = occurrences)

**Mobile: shared "Su" primitives that already exist**

| Primitive | Uses | Alive today? |
|---|---|---|
| `SuCard` | 95 | partly (press feedback only when tappable via `SuPressable`) |
| `ListRow` | 98 | partly |
| `StatTile` / `HeroCard` | 57 | ✅ numbers roll (`AnimatedDigits`) |
| `SuField` | 113 | ❌ no animated focus, error shake or success tick |
| `SubmitButton` | 92 | partly (spinner; no check or shake) |
| `AsyncView` | 72 | ✅ skeleton + cross-fade |
| `StatusBadge` | 133 | ⚠️ `pulse:` loops forever (see §3.4) |
| `EmptyState` | 53 | ✅ |
| `Gauge` | 16 | ✅ fills (900 ms) |
| `MoneyText` | 21 | ❌ static |
| `showToast` / `SuToaster` | 109 | ✅ spring, swipe, countdown hairline |
| `showFormSheet` / `confirmDialog` | 49 / 28 | partly (sheet AnimationStyle; no drag resistance tuning) |
| `showSuccess` | 27 | ✅ full-screen burst |
| `SuPressable` | 14 | ✅ (but used in only 14 places) |
| `SuEnter` / `SuStagger` | 30 / 1 | ✅ |

**Mobile: raw primitives outside the wrappers** (features / core): `FilledButton` 31/13,
`OutlinedButton` 35/5, `TextButton` 42/7, `IconButton` 37/7, `InkWell` 9/8,
`GestureDetector` 7/1, `ListTile` 4/1, `SwitchListTile` 2, `TextField` 6,
`CircularProgressIndicator` 3/1, `LinearProgressIndicator` 2, `Image.*` 9,
`showModalBottomSheet` 7/2, `RefreshIndicator` **24**/1, `SnackBar` 1, `TabBar` 4.
Worst files: `auth/invitation_screens.dart` (18 raw), `shell/app_shell.dart` (17),
`lcd/lcd_sejour_screens.dart` (13), `lots/lots_screens.dart` (12),
`incidents/incidents_screens.dart` (12).

**Web: shared primitives**

| Primitive | Uses | Alive today? |
|---|---|---|
| `Button` / `ButtonLink` | 228 / 75 | ✅ press scale (`.su-btn:active`) |
| `SubmitButton` | 111 | partly (`data-pending` spinner; no check or shake) |
| `StatCard` | 100 | ✅ Odometer, **on first render only** |
| `Card` / `a.card` | 157 | ✅ hover and press |
| `Modal` | 99 | ✅ enter/exit, bottom sheet < 768 px; ❌ no drag-to-dismiss (only the shell sheet has it) |
| `Field` / `Input` / `Select` / `Textarea` | 383 / 253 / 112 / 40 | ❌ no animated focus ring, error shake or valid tick |
| `Switch` / `Checkbox` | 14 / 20 | ✅ thumb and check animate |
| `Badge` | 184 | ⚠️ `pulse` loops forever (§3.4) |
| `Banner` | 124 | ❌ instant |
| `FormAlert` | 153 | partly (toast); `celebrate` prop has **0 uses** (19 direct `celebrate()` calls instead) |
| `EmptyState` | 60 | ✅ |
| `ProgressBar` / `RingGauge` | 14 / **0** | ✅ fill on mount, not on change |
| `Donut` / `Bars` / `TresorerieChart` / `AgeingBars` | 7 / 4 / – | partly |
| `Segmented` / `LinkTabs` | 7 / 13 | ✅ pill and indicator slide |
| Skeletons | 88 | ✅ shimmer, RTL-aware |
| `Toaster` | – | ✅ spring, swipe, timer hairline |

**Web: raw primitives**: `<button>` 37/22 files (8 in `app-frame.tsx`, which is acceptable inside the
shell), `<a>` 39, `<Link>` 135/58 files (styled as `a.card` or plain links), visible `<input>` 25
(+366 `type="hidden"`, not UI), `<select>` 2, `<textarea>` 1, `<table>` 3, `<img>` 18/13 files
(`fade-img` exists but is not applied everywhere), file inputs 26.

### 2.3 Money, numbers, charts
- `formatMAD`: **94 uses on mobile, 107 on web**. Only **4 mobile and 15 web** go through a rolling
  counter. About **90% of amounts are static text**, and **none** re-roll on refresh.
- No chart library on either side. Hand-made painters (`_TresoreriePainter` on mobile, SVG on web).
  All static, or animated on mount only. Nothing morphs between periods.

## 3. Static moments ("dead" today)

### 3.1 Full-screen or bare spinners (target: zero)
Mobile: `SplashScreen` (logo + `LoadingOrb`), `ag_seance_screen.dart:56`,
`document_viewer_screen.dart:160,212`, `visites_screens.dart:368`, `invitation_screens.dart:327`.
Inline bare indicators: `visites:210`, `parametres:283`, `personnel_rh:387`, `lots:945`,
`profil:222`.
Web: `Spinner` in `document-viewer.tsx` and `ag/[id]/seance/pupitre.tsx`. Two `<Suspense>` with no
fallback.

### 3.2 Instant swaps (no transition)
Mobile: `notifications_screen.dart:54` (unread filter), `login_screen.dart:109` (phone ↔ email),
`rapports_screens.dart:259` (year), `profil_screens.dart:116`, `litiges_screen.dart:129`, 10
`FilterChips` lists, `parametres_screen.dart:115-116` switches. 336 `setState` calls in total, most
of them harmless.
Web: every `router.refresh()` (live updates every 25 s, after each notification and on focus)
**repaints without motion**: new rows appear, amounts change in place, nothing signals it.
`import-client` progress and the AG vote screens (`pupitre`, `vue-votant`) jump.

### 3.3 Dead or weak taps
- Mobile: 13 `FilledButton`, 5 `OutlinedButton`, 7 `TextButton`, 7 `IconButton` in `core` plus all
  of `features` use Material ink only (ripple, no scale, no haptic). `SuCard`/`ListRow` are
  pressable only where `SuPressable` was added (14 places).
- Web: plain `<Link>` text links and `<button>`s outside `.su-btn` (photo picker and gallery,
  incident form, AG room) have hover only, with no press feedback.
- Haptics: 5 calls in the whole mobile app.

### 3.4 Restraint violations to remove (brief: "no looping attention-seekers")
- `StatusBadge(pulse:)` (mobile, `badge.dart:55`) and `Badge pulse` (web, `.pulse-halo`) loop
  forever, often **inside list items**. **19 call sites.** Change: one soft pulse on appear, then still.
- `_RingingBell` (mobile shell): check it rings once per new notification, not continuously.
- Ambient loops in `EmptyState` motifs (`motif-sun/win/tree`, mobile `_MotifPainter`) and
  `hero-drift` (24 s). They are slow and calm, so I propose keeping them, pausing them when
  off-screen, and dropping them in lite mode.

## 4. Gaps against the brief, and what I propose

| Brief item | Status | Proposal |
|---|---|---|
| Motion tokens | exist, different values (fast 120 / base 220 / slow 350) | Move to the brief's values (100/180/260/400/600–900), add `instant` and `signature`, plus **real springs** (`SpringDescription` snappy/smooth/gentle on mobile; `linear()` spring easings + `motion` springs on web). Same names on both sides. |
| Haptics service | ❌ | Mobile `Haptics` (tap/select/success/warning/error/heavy) over `HapticFeedback`, 80 ms throttle, toggle. Web: `navigator.vibrate` on Android only, otherwise a no-op. |
| Sound service | ❌ | Mobile: **new dependency** `audioplayers` (or `just_audio` + `audio_session` for the iOS ambient category). Web: Web Audio API, preloaded buffers, unlocked on first gesture. 6 sounds, placeholders synthesised by a script, `SOUNDS.md` for the real ones. |
| "Sensations" settings | ❌ | Mobile: section in `ProfilScreen`. Web: section in `/profil`. **Storage: see decision D2.** |
| `alive_v1` flag | ❌ no mechanism | **See decision D1.** |
| Lint "no raw primitives" | ❌ mobile, partial web | Mobile: a CI script (`tool/check_alive.dart`) that fails on `FilledButton(`, `InkWell(`, `GestureDetector(`, `RefreshIndicator(`, `CircularProgressIndicator(`… under `lib/features/`, with an allowlist comment `// alive:allow <reason>`. It is simpler and lighter than `custom_lint`. Web: ESLint `no-restricted-syntax` on JSX `<button>`, `<img>`, `<input>` (except `hidden`/`file`) outside `components/ui` and `components/shell`. The same script **generates the coverage report**. |
| Buttons: spinner → check / shake | partial | `SubmitButton` gets a result state. Web reads the `useActionState` state already passed to `FormAlert`. **No change to actions.** |
| Numbers roll + green/red tint | partial | Mobile `MoneyText` → animated (it already receives the value). Web: a small `"use client"` `<LiveNumber>` that remembers the previous value and re-rolls after `router.refresh()`. Tint by sign of the change. |
| Inputs | ❌ | `SuField` / web `Field`: animated focus ring, error shake mirrored by `--dir`, valid tick. No floating labels: labels sit above the field in the Wise language (design system of 2026-10-05). I propose **not** adding floating labels, to avoid breaking the design. |
| Lists: insert, remove, reorder | ❌ | Mobile: `SuAnimatedList` (implicit diff by key). Web: `AnimatePresence`/`layout` would mean loosening the ESLint rule. I propose a CSS + `@starting-style` row entrance and a highlight class on keys that are new since the last render (tiny client wrapper). |
| Swipe actions, long-press lift | ❌ | Only where an action already exists (no new business actions). Candidates: notifications (mark read), tasks (status). |
| Shared elements | ❌ | Mobile: `Hero` for lot photos, receipts, document thumbnails. **Caution:** the shell and splash use `NoTransitionPage` on purpose (bug fixed on 2026-10-01). Web: View Transitions API (`document.startViewTransition`, progressive enhancement; ignored where unsupported). |
| Large-title headers | ❌ | Mobile `SuPage` → `SliverAppBar.large`-style collapse. Web: sticky header with fade-in background on scroll. |
| Pull to refresh | Material default (24) | `SuRefresh`: a SyndicUp chevron indicator + `select()` at the threshold. |
| Toasts | ✅ | Add haptics/sound hooks only. |
| Charts | static | Draw-in on first view; morph between periods (interpolate values, same painter). |
| Skeletons | ✅ (web 88, mobile `LoadingList`) | Replace the §3.1 spinners; match exact layout on the 5 mobile screens. |
| Live data | SSE exists | Animate what `router.refresh()` / provider invalidation changes: highlight new rows, re-roll numbers. **No new endpoint.** |
| **Presence** | ❌ backend | No such system exists ("présence" in the code = staff attendance). It would need a **new API endpoint and new tables**, which the brief forbids. **See decision D3.** |
| Connectivity banner and pending ticks | partial (mobile pill + 4 local badges; web none) | Mobile: one calm global banner; existing queued items get "pending" → tick. Web: `online`/`offline` events → banner only (no offline queue; finances never queue). |
| App return | partial | Mobile: `AppLifecycleListener` → invalidate visible providers with `skipLoadingOnRefresh` (no blank flash). Web already refreshes on focus; make it animate (live numbers + rows). |
| Splash → dashboard | hard cut (`NoTransitionPage`) | A logo `Hero` / cross-fade **inside** the destination screen, keeping `NoTransitionPage` on the route (do not undo that fix). |
| Lite mode | ❌ | Mobile: **new dependencies** `battery_plus` (battery saver) + an Android `isLowRamDevice` check (`device_info_plus` or a 10-line channel). Web: `navigator.deviceMemory ≤ 2` / `hardwareConcurrency ≤ 4`. Lite keeps press feedback and number rolls and drops ambient effects, parallax and tilt. |
| Gyroscope tilt | ❌ | **I propose dropping it** (new `sensors_plus` dependency, battery cost, little value for a 40–65 audience). Optional, see D4. |

## 5. Signature moments mapped to real flows

| # | Moment | Where it exists today | Note |
|---|---|---|---|
| 1 | Payment recorded | mobile `PayerScreen`/`JustificatifsScreen` → `showSuccess`; web `finances/paiement-modal` → `celebrate()` | Hook into the existing success, after the API answers. |
| 2 | **12 annexes generated** | **Not found in the code** (no "annexe" in the i18n dictionaries or API) | The Décret 2.23.700 export module doesn't exist yet. I will build the `SealSequence` primitive and wire it when the module ships. I won't invent business logic. |
| 3 | Reminder / call for funds sent | web `appels-de-fonds`, relances; mobile `AppelDetail` | |
| 4 | AG vote cast | mobile `ag_seance_screen` (5 s polling); web `vue-votant`, `pupitre` | Results bars morph between polls. |
| 5 | Expense justified | mobile `depenses` payment with receipt photo; web `depense-actions` | |
| 6 | Residence 100% up to date | dashboard collection rate (`Gauge` / `StatCard`) | Once per period, stored device-side. |
| 7 | Onboarding / first login | mobile `OnboardingScreen`; web `guided-tour` | |

All of them: ≤ 1.2 s, skippable on tap, never blocking. They fire **only after** the server
confirms, so they never imply success on their own.

## 6. Decisions I need from you

**D1 — How `alive_v1` is switched off "instantly".** There is no flag system today.
- **(a) Recommended:** a `GET /config/client` endpoint (contract-first in `openapi.yaml`) returning
  `{ flags: { alive_v1: true } }` from an API env variable. You flip the env variable and restart
  the API, and both clients follow on the next launch or refresh. This adds an endpoint (not business logic).
- (b) Build-time only (dart-define + `NEXT_PUBLIC_ALIVE_V1`). Zero API change, but switching it
  off on mobile needs a new release, which is **not** instant.
- (c) Firebase Remote Config on mobile (Firebase is already there) + env on web.

**D2 — Where "Sensations" preferences live.**
- **Recommended:** on the device (`shared_preferences` / `localStorage`). No schema or API change. A
  user who changes phone gets the defaults again (all ON).
- Alternative: server-side on the user profile, which needs a migration and a contract change.

**D3 — Presence indicator (Phase 3).** It needs new backend work. Options: drop it from this
project,
or treat it as a separate, approved backend ticket (heartbeat endpoint + table + RLS).

**D4 — Gyroscope tilt.** Drop it (recommended) or keep it behind the setting.

**D5 — Web `motion` library boundary.** The ESLint rule keeps `motion` (≈ 30 KB gz lazy) in the
shell, so login pages stay light. Alive needs list/layout animation in pages. Recommended: allow it
in `components/ui/**` only (never in `(public)`), with page code still CSS-first.

**D6 — Token values.** Moving to the brief's durations changes the timing of every existing
animation slightly (fast 120 → 180, base 220 → 260). Recommended: yes, for a single set of values.

## 7. Delivery plan (adapted)

Each phase is one branch, `feature/alive-<phase>`, with Conventional Commits. **There is no `gh` CLI on
this machine**, so I prepare the branches and PR descriptions, and you open the PRs.

| Phase | Content | Est. size |
|---|---|---|
| 1 Foundations | tokens v2 (both sides), `Haptics`, `Sounds` + placeholder generator + `SOUNDS.md`, `AliveFlag`, lite-mode detector, "Sensations" settings (FR/AR), `check_alive` scripts | ~1.5 k lines |
| 2 Components | contract in §4 applied to the shared primitives, then migrate raw usages (mobile ≈200 call sites, web ≈80), coverage report generated by the script | largest, split into 2a (primitives) and 2b (migration) |
| 3 Ambient | live updates (rows + numbers), connectivity banner and pending ticks, app return, splash continuity, greeting, hero drift, scroll reveal (presence per D3) | medium |
| 4 Signature | 7 moments of §5 (#2 primitive only) | medium |
| QA + guide | FR/AR × light/dark × reduce motion × sound/haptics matrix, `ALIVE_GUIDE.md` | – |

**Verification I can and cannot do from here**
- **Can:** `flutter analyze`, unit and widget tests, run the Android emulator and record with
  `adb shell screenrecord`, and run the web dev server.
- **Cannot:** produce iOS recordings (no Mac), measure on a physical low-end Android, or hear the
  sounds. For frame rate I can give `flutter run --profile` numbers on the emulator
  with a throttled CPU, which is a proxy and not a real device. The final low-end numbers need one real
  mid-range phone on your side.

**Safety:** no change to business logic, API calls, money computations or append-only tables. The
only possible API touch is D1(a), which you have to approve.
