# Restyle brief for Claude Code

Copy `DESIGN_SYSTEM.md`, `tokens.css` and `tokens.ts` into the repo (suggested: `docs/design/`), then paste the prompt below into Claude Code.

---

## The prompt

> The app works and I'm not changing behaviour. I'm re-skinning it to match a specific design system, end to end, web and mobile.
>
> Read `docs/design/DESIGN_SYSTEM.md` first and treat it as law. `tokens.css` (web) and `tokens.ts` (native) are the only permitted sources of color, type, radius, spacing and shadow values.
>
> **Constraints**
> - Do not change routing, state, data fetching, business logic or component APIs. Presentation only.
> - Do not add a UI library. Restyle what exists.
> - No new colors, no new radii, no shadows other than `nav-shadow`.
> - Don't invent screens or components that aren't already in the app.
> - Keep every commit reversible and scoped to one phase.
>
> **Work in these phases and stop for my review at the end of each one.**
>
> **Phase 0 — Audit.** Don't change anything yet. Produce `docs/design/AUDIT.md` listing: every hardcoded color/hex in the codebase with file and line; every distinct border-radius, font-size and box-shadow in use; the shared primitives that already exist (button, card, badge, input, nav) and where they live; and the files that will need to change per phase. Flag anything that can't map cleanly onto the system and ask me about it rather than guessing.
>
> **Phase 1 — Tokens.** Wire `tokens.css` / `tokens.ts` into the app root. Load Plus Jakarta Sans (400/500/600/700/800). If Tailwind is in use, move the values into the theme config instead and delete the default palette so stray classes like `bg-gray-200` fail loudly. Nothing should look different yet except the typeface.
>
> **Phase 2 — Primitives.** Rebuild the shared primitives against §2 of the design system: `StatusPill`, `ListRow`, `OverviewTile`, `HeroCard`, `TransactionRow`, `Tabs`, `SearchField`, `Banner`, `CircleButton`, `DonutStatCard`, `BarChart`, `Nav`. Same props as today wherever possible; add variant props only where §2 requires them. Include hover, focus-visible and disabled states per §4.
>
> **Phase 3 — Screens.** Migrate screen by screen in this order: Home → Properties (both tabs) → Maintenance → Financials → Payments/Overdue → everything else. For each screen, replace ad-hoc markup with the primitives from Phase 2 and delete the styles it leaves orphaned. Use the recipes in §3 for the six screens they cover; for the rest, compose from the same primitives and follow the closest recipe.
>
> **Phase 4 — Sweep.** Grep for remaining hex codes, `rgba(`, `box-shadow`, `border-radius`, `font-family` and raw `px` font sizes outside the token files, and eliminate them. Then verify the checklist below and report anything you couldn't resolve.
>
> **Checklist to verify before you call it done**
> - [ ] No hardcoded colors anywhere outside the token files
> - [ ] Every card is a flat `surface` fill — no borders, no shadows
> - [ ] Radii are only 16 / 20 / 24 / 999, applied per §1.3
> - [ ] Every status is a pill; no colored text or dots standing in for one
> - [ ] Every drill-in affordance is a filled circular arrow, not a chevron
> - [ ] Money uses `+` / `−` (U+2212), green up, red down, tabular figures
> - [ ] Bottom nav on mobile, 240px sidebar on desktop, same five destinations
> - [ ] Layouts hold at 375, 768, 1024 and 1440
> - [ ] Keyboard focus visible on every interactive element
> - [ ] `prefers-reduced-motion` respected
> - [ ] Contrast: black on `yellow-400` and white on `blue-600` both pass AA at their sizes

---

## Two things worth deciding before you start

**The typeface.** The reference renders read as Plus Jakarta Sans; Manrope is the closest alternative if you compare against the source file and it doesn't match. Whichever you pick, set it in Phase 1 and don't revisit it — swapping families late invalidates every spacing decision made after.

**The hero illustration.** The isometric house render on the Home hero card is an asset, not something to rebuild in code. Export it from the Figma file as a 3x PNG (or SVG if it's vector) before Phase 3, or that screen will stall.

## Getting exact values from the source file

The community link only exposes its thumbnail page to tooling. To read the real variables: open the file in Figma → **Duplicate to your drafts** → open that copy in the Figma **desktop app** → select a frame. The Figma connector can then read per-node styles and variables directly, and you can diff them against `tokens.css` in one pass.
