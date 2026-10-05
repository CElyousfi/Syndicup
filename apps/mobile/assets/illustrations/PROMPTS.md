# SyndicUp: 2D illustration prompts

All app visuals use one **flat 2D** style built on the new logo: bold geometric shapes and solid colour.
There is **no 3D, no depth, no gradients and no shadows**. Every image comes from the same visual family as
the logo's stacked chevron arrow.

## 1. How to generate (read this first)

1. Start every prompt with the **STYLE BLOCK** below, then add the image's own SUBJECT line.
2. **Lock the style before batching.**
   - Generate `ok-general` first, then `empty-incidents`.
   - Pick the best of each and use them (plus the logo image) as **style reference images** for every other image.
     Midjourney: `--sref`. Higgsfield, Ideogram, Recraft: style or image reference.
3. **Recraft is the best fit if you have it**: set its style to "Vector art / flat" and it can export SVG and
   transparent PNG directly.
4. **Background:**
   - Use a transparent PNG where your tool allows it.
   - Otherwise use a plain solid white background with nothing touching the edges, and I will cut it out.
   - Posters are the exception: they have a full background.
5. Name each file **exactly** as listed and drop it in this folder. The app picks it up automatically.

| Group | Size | Background |
|---|---|---|
| Onboarding, success, empty states, offline | 2048×2048 | transparent |
| Posters | 1600×1000 | full solid colour (green or ink) |
| Quick actions | 512×512 | transparent |

### Palette (taken from the logo, use ONLY these)

| Role | Hex |
|---|---|
| Brand green (logo chevron, "up") | `#1E7552` |
| Lime (logo on green) | `#E3EF8D` |
| Ink (logo "syndic") | `#121212` |
| Greige (app background) | `#ECEBE4` |
| White | `#FFFFFF` |
| Soft green (light tint, optional) | `#A4C8AE` |

Status colours: use a small touch of warm red `#98140B` only in incident or alert scenes, and amber `#8A5A00`
only for a "pending" detail. Nothing else.

### STYLE BLOCK (paste at the start of every prompt)

```
Flat 2D vector illustration, bold geometric shapes, solid flat colour fills only, NO gradients, NO shadows,
NO 3D, NO perspective rendering, NO texture, NO grain, NO outlines (shapes defined by colour only), crisp
straight edges and generous rounded corners, chunky simplified forms like modern fintech brand illustration
(Wise / Monzo editorial style). Strict palette: brand green #1E7552, lime #E3EF8D, ink black #121212,
greige #ECEBE4, white #FFFFFF, soft green #A4C8AE. Lots of negative space, single centred subject, calm and
confident, no text, no letters, no numbers, no logos, no watermark. Recurring motif: a bold upward double
chevron (two stacked "^" shapes over a short vertical bar) used sparingly as a graphic accent.
```

People (only in the images that mention them): faceless, simplified flat figures. Use solid-colour bodies,
round heads with no facial features, and a mix of skin tones in flat colours. Some wear a hijab and some are
older, as a natural Moroccan mix. Draw them from the waist up or as hands only. No cartoon faces.

Architecture: Moroccan modern residential buildings, drawn as flat blocks. Use arched windows, a hint of
zellige pattern as simple flat geometric tiles, flat roofs with a terrace, and a palm or olive tree as simple
shapes.

---

## 2. Onboarding & welcome (2048×2048)

Large hero images; they sit on a white screen above the title.

- **`ob-1-residence`**: *"Your residence in your pocket."*
  - A flat Moroccan apartment building (4 floors, arched windows, green door) with a large phone shape
    beside it.
  - The phone screen shows the same building as simple flat blocks.
  - A lime upward double chevron rises from the rooftop like a flag.
  - Greige ground strip; one olive tree as a simple shape.
- **`ob-2-charges`**: *"Clear, shared charges."*
  - A large flat circle split into neat segments (green, lime, soft green, ink), like a pie of building costs.
  - Small flat icons orbit the circle: a key, a light bulb, a water drop, a broom.
  - Two hands from either side, one placing a coin-shaped disc into the circle.
- **`ob-3-incident`**: *"Report an issue in seconds."*
  - A flat hand holds a phone; the screen shows a camera viewfinder framing a dripping pipe.
  - Three simple flat water drops; a wrench beside it.
  - A small lime check bubble pops out of the phone.
- **`ob-4-ag`**: *"General assembly, from anywhere."*
  - Three faceless flat figures in different places: one on a sofa, one at a café table, one in a room.
  - Each holds up a phone; each phone shows a large green check mark.
  - The three phones connect with simple lime curved paths to a central ballot box drawn as a flat green cube
    face (front view only).
- **`welcome-hero`**: the brand moment.
  - A tall flat building made of stacked rectangles in green, lime, soft green and ink, with arched windows.
  - The building's silhouette rises into a giant upward double chevron at the top, so the building becomes the
    logo symbol.
  - Small flat clouds, a sun disc in lime. Balanced, iconic, poster-like.

## 3. Success screens (2048×2048)

These are shown full screen after an action, so they should feel celebratory but calm. Common base: a central
object inside a large soft-green circle, with a ring of small lime confetti made of flat circles, short
rounded bars and tiny chevrons.

- **`ok-general`**: a big green circle with a lime check mark, surrounded by the confetti ring. Bring a large
  upward double chevron in from below. (Generate this one first and use it as the style reference.)
- **`ok-paiement`**: a flat wallet or bank card in green with a lime check badge on its corner. Flat coin
  discs fly upward along a chevron-shaped path.
- **`ok-incident`**: a flat clipboard with a wrench and a lime check badge. A small flat toolbox beside it.
- **`ok-vote`**: a flat hand dropping a folded ballot into a green box; a lime check above the slot.
- **`ok-reservation`**: a flat calendar page with one day circled in lime and a check. A pool ladder or a room
  key as a small secondary object.
- **`ok-invitation`**: a flat envelope opening with a lime card rising out of it. The card shows a simple house
  shape and a check.
- **`ok-visiteur`**: a flat door slightly open with a lime badge or pass hanging from the handle; a check
  bubble.

## 4. Empty states (2048×2048)

Quieter, smaller and more muted. Use mostly soft green, greige and ink, with one lime accent. One simple object
or small scene only.

- **`empty-incidents`**: a calm flat toolbox, closed, with a small lime check. Nothing is broken.
- **`empty-appels`**: an empty flat envelope tray with a single lime coin resting in it.
- **`empty-documents`**: an empty flat folder, slightly open, with one blank page peeking out.
- **`empty-reservations`**: a flat calendar page with no marks; a small lime pool float ring beside it.
- **`empty-visites`**: a flat front door, closed, with an empty doormat.
- **`empty-notifications`**: a flat bell, silent, with a small lime "zz" made of shapes (no letters). Use a
  crescent moon instead of letters.
- **`empty-ag`**: an empty flat chair facing a small lectern.
- **`empty-annonces`**: an empty flat noticeboard (cork shown as greige) with a single lime pin.
- **`empty-lots`**: a flat building outline with all windows empty (greige) and one lime "plus" shape beside it.
- **`empty-taches`**: a flat checklist clipboard with empty boxes; a pencil lying across it.
- **`empty-parkings`**: an empty flat parking bay seen from above, white lines on ink tarmac, with one lime
  marker.
- **`empty-lcd`**: a flat suitcase standing alone next to a key on a ring.
- **`empty-personnel`**: a flat empty coat hook with a cap, and a broom leaning against the wall.
- **`empty-litiges`**: a flat balance scale perfectly level, calm.
- **`empty-search`**: a flat magnifying glass over an empty greige rectangle; one tiny lime spark.
- **`offline`**: a flat cloud shape with a small unplugged cable, the two plug ends apart, and a lime spark
  gap between them.

## 5. Posters (1600×1000, full background)

These are the dark "poster" cards and fill the whole frame. Alternate the two backgrounds. Keep the **left
half calm and empty** because the app writes the title there (on the right in Arabic). Put the illustration in
the right ~45%. Do not mirror the images; the app handles that.

- **`poster-ag`**:
  - Background: brand green `#1E7552`.
  - Lime and white flat shapes: a lectern, three raised hands, a ballot box.
  - A giant lime double chevron rising behind them.
- **`poster-onboarding`**:
  - Background: ink `#121212`.
  - A lime-and-green flat building whose roofline forms the double chevron.
  - Small soft-green stars as simple dots.
- **`poster-transparence`**:
  - Background: brand green.
  - A flat bar chart of 4 rising lime bars, the last topped by an upward chevron.
  - A white magnifying glass resting on the bars.
- **`poster-annonce`**:
  - Background: ink.
  - A large lime flat megaphone with three simple green arcs coming out.
- **`poster-securite`**:
  - Background: brand green.
  - A lime flat shield with a white keyhole.
  - A white flat key crossing in front of it.

## 6. Quick actions (512×512, transparent)

These are small tiles in the "+" action sheet. Make them **icon-like**: one chunky object, very simple, and
readable at 48 px. Draw the object in ink and brand green with one lime highlight, on transparent.

| File | Object |
|---|---|
| `quick-paiement` | a bank card with a lime check |
| `quick-payer` | a flat coin stack with an upward chevron above |
| `quick-appel` | an envelope with a coin on it |
| `quick-invitation` | an envelope with a lime "+" |
| `quick-incident` | a wrench crossed over a water drop |
| `quick-sejour` | a suitcase with a lime tag |
| `quick-reservation` | a calendar with one lime day |
| `quick-ag` | a ballot box with a lime ballot |
| `quick-visiteur` | a door with a lime pass hanging |
| `quick-copropriete` | a small building with a lime "+" |

---

## 7. Logo files I need (separate from the illustrations)

The logo board you shared looks AI-rendered (soft edges, slightly uneven letters), so it can't be used directly
for the app icon or the splash screen. I need clean files:

- **Symbol** (double chevron + bar) as **SVG**, in green, lime, ink and white versions.
- **Wordmark** "syndicup" as **SVG**, in two versions: ink + green "up", and all lime.
- **App icon** 1024×1024 PNG: lime symbol on green `#1E7552`, square, no rounded corners (the phone rounds it).

If you only have the PNG, I can redraw the symbol as a clean SVG myself, since it is simple geometry. The
wordmark is best exported from the original design tool.
