# Allmat Prisbild — design

Date: 2026-09-17 · Status: approved in chat, awaiting written-spec review

## Purpose

The owner of Allmat Värmland AB (a supermarket in Sweden) photographs products and posts 10–15 images per Facebook post, each with a hand-pasted price sticker. It is slow and looks amateur. This app turns a batch of raw phone photos into branded, priced images in one pass, with no design decisions left to the user.

## Constraints

- Static files on GitHub Pages. No backend, no accounts, no API keys, no per-image AI calls. Running cost: zero.
- Primary device: iPhone, Safari "Add to Home Screen" (standalone PWA). Minimum iOS 17 (native HEIC decode).
- Everything rendered ON the images is Swedish. App UI defaults to Swedish; a toggle switches the UI to Arabic.
- The price is a fixed, designed part of the frame. It is never draggable, resizable or rotatable.
- No framework, no build step. Vanilla HTML/CSS/ES modules. All URLs relative so the app works under `/<repo>/`.

## User flow

1. **Start** — two buttons: `Ta foto` (input with `capture="environment"`, single) and `Välj bilder` (input with `multiple`). Both can be used repeatedly; every photo lands in the same batch.
2. **Batch box** — a grid of thumbnails. Each thumbnail has an ✕ to remove it, a status dot (ready / price missing), and can be reordered. A colorway picker (3 options) applies to the whole batch.
3. **Edit card** — tap a thumbnail (or swipe through) to fill: price (required), unit chip (`/kg`, `/st`, `/förp`, `/liter`, `/100g`, none), optional weight/volume (`5 kg`, `500 g`, `1,5 L`), optional product name, optional comment, mode (`Standard`, `Nyhet`, `Kampanj` with old price). Live preview. The photo can be panned/zoomed inside its slot; nothing else moves.
4. **Generate** — one tap `Skapa alla bilder` renders every ready photo sequentially with a progress bar (cancellable). Photos without a price are flagged, not silently skipped.
5. **Output** — two separate, user-tapped actions on the prepared JPEGs:
   - `Spara i Bilder` — opens the iOS share sheet with all files; the user taps "Spara N bilder". (Web apps cannot write to the Photos library directly; the share sheet is the only route.)
   - `Dela` — same share sheet, aimed at Facebook.
   - Fallbacks: share one at a time; per-image view for long-press save; plain download links on non-iOS.
   Preparation and sharing are separate taps because Safari drops the user-activation needed by `navigator.share` if rendering happens between tap and share.

## Visual system on the images

- One layout, square 1080×1080. (9:16 story format is v2 and gets its own layout, not a scaled copy.)
- **Three colorways of the same design**, chosen per batch: `Röd` (red price badge, green/black accents), `Grön` (dark green dominant, red price), `Svart` (black premium with red/green accents). Colorway = a token set; frame shapes are drawn by code so colorways are free. Optional decorative artwork (textures/ornaments) ships as static PNGs per colorway, generated once by the project owner with an image model from prompts we supply. No text or digits ever come from an image model.
- **Price block** — a parsed component, not a text string. Input accepts `24,95`, `24.95`, `24`, `24:-`, and Arabic-Indic digits; normalises to integer + two decimals (or none). Renders big integer, raised small decimals, small `kr`, unit beneath/beside. Each run has its own size constraints; the block auto-fits from `9` to `1299,95`. `Kampanj` adds a struck-through old price. Multi-buy (`2 för 30 kr`) is a variant of the same block.
- Logo (cut out from `brand/logo-source-facebook.jpeg` to transparent PNG: full lockup + symbol only) in a fixed safe area. Name strip and weight badge in fixed positions; they collapse cleanly when empty.
- Font: one self-hosted OFL family covering Swedish glyphs with a heavy display weight; loaded via `FontFace`, added to `document.fonts`, awaited before any canvas draw. Export is blocked if the font failed to load.

## Architecture

Small ES modules, each with one job:

| Module | Responsibility | Depends on |
|---|---|---|
| `config/store.js` | Store name, logo paths, colorway tokens | — |
| `core/price.js` | Parse/normalise/validate price input → price model | — |
| `core/layout.js` | Pure geometry: given fields + canvas size → boxes and font sizes | `price` (model only); text measuring injected |
| `core/render.js` | Draw photo, frame, logo, price block to a canvas from a layout | `layout`, `config` |
| `core/photo.js` | Decode file → oriented, downscaled (max 2160 px) bitmap/blob; one at a time; releases resources | — |
| `core/batch.js` | Batch state: items, order, fields, colorway, statuses | — |
| `core/storage.js` | IndexedDB persistence of the single active batch (blobs + fields); `navigator.storage.persist()`; quota errors surfaced | `batch` |
| `core/export.js` | Sequential render → JPEG blobs (q 0.92), progress, cancel; `canShare` check; share/save/fallbacks | `render`, `photo` |
| `ui/*` | Screens, i18n (`sv` default, `ar`), RTL handling | all above |
| `sw.js` | App-shell cache, relative scope `./`, "ny version finns" prompt | — |

Photo decode uses `<img>` + `decode()` (not `createImageBitmap(blob)`, which has an open EXIF-orientation bug in WebKit) unless device testing proves otherwise. Only compressed blobs are retained; decoded images live only while one photo is being processed.

## i18n and RTL

Dictionary-based. `sv` is the default and the fallback; choice stored in `localStorage`. In Arabic mode the chrome mirrors, but price inputs, unit chips and the preview stay LTR; free-text fields use `dir="auto"`.

## Resilience

- Every edit autosaves; a `Sparat ✓` indicator confirms. On launch an unfinished batch is offered for recovery. The batch is purged after the user confirms export.
- Storage quota and persistence failures show a clear message rather than losing work silently.
- If the iOS file picker misbehaves in standalone mode, a hint tells the user to close and reopen the app.

## Testing

- Unit tests (Node test runner, no deps): price parsing/normalisation, layout geometry across the price range and optional-field combinations, batch state, i18n completeness.
- Tolerant visual check of the renderer in a desktop browser.
- Mandatory real-iPhone standalone pass before handover: 15 HEIC photos, portrait/landscape orientation, offline relaunch, app switching mid-batch, save to Photos, share to Facebook (batch and one-by-one).

## Out of scope for v1

Auto-enhance, background removal, 9:16/4:5 formats, cover collage, second-branch picker (config stays separable), any AI call at runtime.

## Work split

Visual direction of the app UI and the price badge: short, tightly-briefed sessions with `gpt-6-astra` (design tokens + base CSS, badge design, final polish review). Everything else, including all JavaScript, by Claude. Technical decisions debated with `gpt-5.6-sol` at high effort, read-only. Codex usage (5 h window) is checked after every run.

## Known open risk

Whether Facebook's share extension accepts a 10–15 file batch can only be confirmed on the owner's phone. The save-to-Photos route is the guaranteed path; sharing directly is the convenience path.

## Addendum 2026-09-18 — templates and the Lista sheet

The single bordered frame described above was replaced, at the owner's request, by code-drawn minimalist templates chosen per batch: `Sockel`, `Kort`, `Signatur` (one image per product, `js/core/layout.js`) and `Lista` (many products on one sheet, `js/core/collage.js`). No generated artwork is used anywhere.

- Colourways: `Röd`, `Grön`, `Svart`, `Gul`. The same role names (`block`, `on`, `paper`, `ink` …) drive every template.
- Lista: each product is a card — photo on top, a colour tag with the price beneath; the product name is optional and is dropped on dense sheets. Up to 20 products per sheet; more are split into balanced sheets (25 → 13 + 12) marked `1/2`, `2/2`. Few products give a square sheet, more give 1080×1350.
- Lista sheet styles share one palette per colourway: `Ljus` (white sheet, colour tags), `Mörk` (dark sheet, colour tags; Svart flips to white tags), `Färg` (colour sheet, white tags). Header: logo, title label, shop name, a note top-right; footer line. All three texts are optional.
- The editor preview for Lista shows the single card at its true proportions, so panning the photo matches the final sheet. Mode, old price, weight and comment are not drawn on Lista and are hidden in its editor.
- With no product name, Sockel and Kort enlarge and centre the logo lockup; Signatur shows the shop name in the name position.
