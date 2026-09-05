# Property Management App — Design System

Single source of truth for restyling the existing app (web + mobile). Every value below is derived from the six reference screens. **Nothing in the app should use a color, radius, font size, or shadow that is not listed here.**

---

## 1. Foundations

### 1.1 Color

**Brand**

| Token | Hex | Use |
|---|---|---|
| `blue-700` | `#0844C4` | Gradient end (deep), pressed states |
| `blue-600` | `#0B5FFF` | **Primary.** Pills ("Rented", "On progress"), circular arrow buttons, active tab underline, active nav icon, links, `UPCOMING` amounts |
| `blue-500` | `#2E7BE8` | Gradient start (deep cards) |
| `blue-400` | `#59A5F0` | Gradient mid (light cards) |
| `blue-300` | `#8CC8FA` | Gradient start (light cards) |
| `blue-100` | `#B9CFF2` | **Inactive** nav icons only |

**Accent**

| Token | Hex | Use |
|---|---|---|
| `amber-600` | `#E4740B` | Maintenance gradient end, orange circle button (`+`, `→` on cream banners) |
| `amber-500` | `#F7941D` | Chart "Revenue" bars, orange FAB fill |
| `amber-400` | `#FBC02D` | Chart "Expenses" bars, donut track fill |
| `yellow-400` | `#FFC93C` | Status pills with **black** text: "Available", "New Request", "Ready to review" |
| `cream-100` | `#FCEFCD` | Soft cards & banners: "Request" tile, "Add new property", "View cashflow statement" |

**Semantic**

| Token | Hex | Use |
|---|---|---|
| `green-500` | `#17B26A` | Money in (`+$5,200`), positive P/L, ▲ triangle |
| `red-500` | `#F2453D` | Money out (`−$2,390`), overdue amounts, negative P/L, ▼ triangle |

**Neutrals**

| Token | Hex | Use |
|---|---|---|
| `bg` | `#FFFFFF` | Page background |
| `bg-alt` | `#FAFAFC` | Page background on list screens (Overdue Payments) |
| `surface` | `#F5F5F7` | **Every neutral card and list row.** Flat fill, no border, no shadow |
| `border` | `#E4E4E8` | Search field outline, chart gridlines (dashed) |
| `text` | `#111113` | Headings, names, amounts, body |
| `text-muted` | `#8E8E93` | Addresses, dates, inactive tabs, `UPCOMING`/`OVERDUE` labels |
| `text-faint` | `#B0B0B5` | Placeholder text |
| `on-brand` | `#FFFFFF` | Text on blue / orange gradients |

**Gradients** — always 135° (top-left → bottom-right).

```
grad-hero      #2E7BE8 → #0844C4   Hero card, "Payments" tile, donut stat cards
grad-sky       #8CC8FA → #2E7BE8   "2025 Revenue" tile
grad-amber     #F7BE2B → #E4740B   "Maintenance" tile
```

### 1.2 Typography

Family: **Plus Jakarta Sans**, fallback `Manrope, "SF Pro Display", system-ui, sans-serif`.
Load weights 400 / 500 / 600 / 700 / 800 only.

| Role | Size | Weight | Line height | Notes |
|---|---|---|---|---|
| `display` | 28 | 700 | 1.15 | "Hello, **Joe!**" — first word 400, name 700 |
| `stat-xl` | 32 | 800 | 1.05 | "$30.2k" |
| `stat-lg` | 30 | 800 | 1.05 | "10" / "7" on hero |
| `stat-donut` | 26 | 800 | 1.1 | "$30,256" inside donut |
| `title` | 20 | 700 | 1.25 | Screen titles: Properties, Maintenance, Financials, Overdue Payments |
| `section` | 18 | 700 | 1.3 | "Overview", "Payment history", "My properties" |
| `card-title` | 17 | 700 | 1.35 | Property names, tenant names, "Plumbing" |
| `tab` | 16 | 600 | 1.3 | Tab labels |
| `body` | 15 | 500 | 1.45 | Card body, transaction descriptions, due dates |
| `meta` | 14 | 400 | 1.45 | Addresses, timestamps, dates — always `text-muted` |
| `pill` | 13 | 600 | 1 | Status pill labels |
| `label` | 12 | 500 | 1 | `UPCOMING` / `OVERDUE` — uppercase, letter-spacing `0.04em`, `text-muted` |
| `nav` | 11 | 500 | 1 | Bottom nav labels |

Rules:
- Sentence case everywhere. Uppercase **only** for the `label` role.
- Inside body copy, the emphasized token is `700` and inherits the surrounding color: "You have **3** new requests", "James has paid monthly rent for **Maplewood Residence**".
- Amounts are always `700`, tabular figures on.

### 1.3 Radius

| Token | Value | Applies to |
|---|---|---|
| `radius-hero` | 24 | Hero card, donut stat cards |
| `radius-card` | 20 | Overview tiles |
| `radius-row` | 16 | List rows, transaction rows, banners, chart container |
| `radius-nav` | 24 | Bottom nav top corners only |
| `radius-pill` | 999 | Status pills, search field, circular buttons, tab indicator caps |

Never mix: a tile is 20, a row is 16. Do not apply one radius to everything.

### 1.4 Spacing

4pt base. Allowed: `4, 8, 12, 16, 20, 24, 32, 40`.

- Page gutter: **16** (mobile), **24** (tablet), **32** (desktop)
- Gap between list rows: **12**
- Gap between sections: **24**
- Section heading → first item: **12**
- Card inner padding: **16** (rows) / **20** (tiles and hero)
- Overview grid: 2 columns, gap **12**

### 1.5 Elevation

The design is **flat**. There are no drop shadows on cards, tiles, pills or rows — separation comes from the `surface` fill against white.

The one exception:
```
nav-shadow: 0 -4px 24px rgba(17, 17, 19, 0.06)
```
applied to the bottom nav bar / desktop sidebar edge only.

Remove every existing `box-shadow` in the app that isn't this token.

### 1.6 Iconography

- Style: **filled**, single color, ~20px in rows, ~24px in nav.
- Inline meta icons (pin, clock, person, calendar) are `blue-600` and sit left of `meta` text with an 8px gap.
- Nav icons: `blue-600` when active, `blue-100` when inactive. Nav labels: `text` when active, `text-muted` when inactive.
- The circular action button is a filled disc with a white `→` glyph: 32px on tiles (`blue-600`), 36px in list rows (`blue-600`), 36px on banners (`amber-500`). Icon stroke 2px.

---

## 2. Components

### 2.1 StatusPill
Height 32, padding `0 16`, `radius-pill`, `pill` type.

| Variant | Fill | Text |
|---|---|---|
| `rented`, `on-progress` | `blue-600` | white |
| `available`, `new-request`, `ready-to-review` | `yellow-400` | `text` |

No borders, no icons inside pills.

### 2.2 ListRow (`surface`, `radius-row`, padding 16)
Two layouts, both used repeatedly:

```
A — title + pill        B — title + circular arrow
┌──────────────────────┐ ┌──────────────────────┐
│ Harborview Suite [●] │ │ Jacob Turner      (→)│
│ 📍 940 Harborview…   │ │ The Silvercrest      │
└──────────────────────┘ │ 501 Silvercrest St…  │
                         │ UPCOMING   OVERDUE   │
                         │ $1,200     $1,490    │
                         │ Due date Mar 16,2025 │
                         └──────────────────────┘
```
Title is `card-title`; pill/arrow is vertically top-aligned with the title, pushed right. Meta lines are `meta`. In the payment variant the two columns split 50/50, label above value, values are `card-title` weight 700 — `UPCOMING` in `blue-600`, `OVERDUE` in `red-500`.

### 2.3 OverviewTile
2-up grid, aspect roughly 1:0.85, `radius-card`, padding 20, gradient or `cream-100` fill.
Layout: title (`body`, 600) top-left + 32px circular arrow top-right; body text bottom-left. On the revenue tile the body is replaced by `stat-xl`.
Text is white on gradients, `text` on cream. The arrow disc is white with a `blue-600`/`amber-600` glyph on gradients, and `amber-500` with a white glyph on cream.

### 2.4 HeroCard
`radius-hero`, `grad-hero`, padding 20, isometric property render bleeding off the right edge, concentric translucent white circles (8% opacity) behind it. Label `body` white, then two stats side by side (`stat-lg` value, `body` caption). White 44px circular `→` button pinned bottom-right with 20px inset.

### 2.5 TransactionRow
`surface`, `radius-row`, padding 16, gap 12 between rows.
Date (`meta`) on its own line, then description (`body`) with the property name bolded, amount right-aligned on the description line in `stat`-weight 700, `green-500` with a leading `+` or `red-500` with a leading `−` (U+2212, not a hyphen).

### 2.6 Tabs
Full-width row, labels `tab`, active `blue-600`, inactive `text-muted`. Indicator: 3px bar, `blue-600`, `radius-pill`, width = label width, sits 12px below the label. Counts go inside the label: "New request (3)". Overflowing tab sets scroll horizontally and are allowed to clip at the edge.

### 2.7 SearchField
Height 52, `radius-pill`, 1px `border`, transparent fill, 20px magnifier in `text-muted`, placeholder `body` in `text-faint`. A filter icon button sits outside to the right, 24px, `blue-600`, no container.

### 2.8 Banner
`cream-100`, `radius-row`, height 64, padding `0 16`, label `card-title`, 36px `amber-500` circular button on the right.

### 2.9 DonutStatCard
`grad-hero`, `radius-hero`, padding 20. Donut: 12px stroke, track white at 100%, progress `amber-400`→`amber-500`, rounded caps, starting at 12 o'clock clockwise. Center: value `stat-donut` white, denominator below in `body` at 70% opacity. Caption at the card bottom in `body` white.

### 2.10 BarChart
Container `surface`, `radius-row`, padding 20. Two filter chips top row (`surface` on white or white on `surface`, `radius-pill`, height 40, chevron). Summary row: label + value triplet (P/L green, Revenue `text`, Expenses `red-500`). Grouped bars: Revenue `amber-500`, Expenses `amber-400`, bar width 16, gap 4 within pair, 28 between years, `radius-pill` on top corners only. Dashed `border` gridlines. Tooltip: white card, `radius-row`, 12px padding, `nav-shadow`, dot-legend rows.

### 2.11 BottomNav (mobile) / SideNav (desktop)
Mobile: white, top corners `radius-nav`, height 72 + safe area, `nav-shadow`, 5 items evenly spaced, icon 24 above `nav` label with 4px gap.
Desktop: same five destinations as a 240px left rail, icon + `body` label, active item gets a `cream-100` pill background with `blue-600` icon and `text` label.

---

## 3. Screen recipes

| Screen | Composition (top → bottom) |
|---|---|
| **Home** | Bell w/ count badge (`yellow-400` disc, black number) + avatar 44 → `display` greeting → HeroCard → "Overview" section → 2×2 OverviewTile grid (Maintenance `grad-amber`, Revenue `grad-sky`, Payments `grad-hero`, Request `cream-100`) → "Payment history" → TransactionRow list |
| **Properties / My Property** | Centered `title` → Tabs → Banner → SearchField + filter → ListRow A list |
| **Properties / Lease Application** | Centered `title` → Tabs → SearchField + filter → ListRow with person + calendar meta icons and status pill |
| **Overdue Payments** | Left-aligned back arrow + `title` on `bg-alt` → ListRow B list |
| **Maintenance** | Centered `title` → Tabs (New request (3) / In progress / Waiting for payment) → cards with category `card-title`, pill, pin + clock meta |
| **Financials** | Centered `title` → 2-up DonutStatCards → BarChart card → cream Banner → "My properties" + "P/L" header row → ranked rows (`#1 Name`, address, ▲/▼ amount and % right-aligned) |

---

## 4. Web adaptation rules

The mobile screens are the source of truth. On web, scale the *container*, never the design language.

- Content max-width **1200px**, centered, 32px gutters.
- Bottom nav → left sidebar (240px). Header row (avatar, notifications) → top bar aligned right.
- Overview tiles: 2-up ≤768px, **4-up** ≥1024px. Tiles keep `radius-card` and their gradients; they get taller, not wider-and-flatter (cap at 280px wide).
- List rows go full container width; add a fourth column for actions rather than stacking.
- Financials: donut cards 2-up stay side by side, chart card spans full width.
- Type scale: bump `display` to 32, `title` to 24, `section` to 20. Everything else stays identical — do **not** scale body copy up.
- Hover is the only added state: `surface` rows → `#EFEFF2`, `blue-600` fills → `blue-700`, 120ms ease. No lift, no shadow, no scale.
- Focus ring: `2px solid blue-600`, 2px offset, on every interactive element.

---

## 5. Hard rules for implementation

1. No shadows except `nav-shadow`.
2. No new colors. If something needs a color that isn't here, it's wrong — reuse an existing token.
3. No borders on cards. Cards are `surface` fills.
4. Gradients only on the six places listed; never as decorative background washes.
5. Status is always a pill, never colored text or a dot.
6. Every "go deeper" affordance is a filled circular `→`, never a chevron or a text link.
7. Money: `+`/`−` prefix, comma thousands, no decimals unless the source has them.
8. Empty states use the cream Banner pattern with an action, not gray placeholder text.
9. `prefers-reduced-motion` disables all transitions.

---

### Note on exactness

Colors and sizes were sampled from the reference renders, so they're accurate to within a shade. To lock them to the source file: duplicate the community file into your own Figma drafts, open it in the Figma desktop app, select a frame, and the Figma connector can then read the real variables and per-node values — the community link on its own only exposes its thumbnail page.
