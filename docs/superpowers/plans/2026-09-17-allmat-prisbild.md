# Allmat Prisbild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An installable, offline, zero-cost iPhone PWA that turns a batch of product photos into branded, priced 1080×1080 images and hands them to Photos/Facebook.

**Architecture:** Static ES modules served from the repo root on GitHub Pages. Pure logic (`core/price`, `core/layout`, `core/batch`, `i18n`) is DOM-free and unit-tested with `node --test`. Browser-only modules (`photo`, `render`, `storage`, `export`, `ui/*`) sit on top and are verified in the browser pane and on a real iPhone.

**Tech Stack:** HTML, CSS, vanilla JS (ES modules), Canvas 2D, IndexedDB, Service Worker, Web Share API. Tests: Node 24 built-in test runner. No dependencies, no build.

**Spec:** `docs/superpowers/specs/2026-09-17-allmat-prisbild-design.md`

## Global Constraints

- No backend, no API keys, no runtime AI calls, no npm dependencies, no build step.
- Every URL in HTML/CSS/JS/manifest/service worker is relative (`./…`); app must work under `https://<user>.github.io/<repo>/`.
- Minimum iOS 17. Primary target: Safari standalone PWA on iPhone.
- All text rendered on images is Swedish. UI default language `sv`; toggle to `ar`. `sv` is the fallback for missing keys.
- The price block is never draggable/resizable. Only the photo pans/zooms inside its slot.
- Output: JPEG 1080×1080, quality 0.92.
- Must not look like a website: standalone display, no browser chrome, safe-area aware, no text selection/callouts/tap highlight/rubber-band/double-tap zoom, app-like transitions, splash + icons.
- Fonts: self-hosted, SIL OFL.
- `gpt-6-astra` only for the three tightly-briefed design sessions; always pass `--model` explicitly. Check Codex 5 h usage after each run.

## File Structure

```
index.html                 app shell, meta tags for standalone iOS
manifest.webmanifest       name, icons, display standalone, colors
sw.js                      app-shell cache + update prompt
assets/fonts/*.woff2       display + text font (OFL)
assets/brand/logo-full.png, logo-mark.png
assets/icons/*             apple-touch-icon, 192, 512, maskable
assets/frames/*.png        optional decorative art per colorway (owner-generated)
css/tokens.css             design tokens (Astra session 1)
css/app.css                layout + components
js/config/store.js         store name, logo paths, colorways
js/core/price.js           parsePrice, formatPriceParts
js/core/layout.js          computeLayout (pure geometry)
js/core/batch.js           batch state reducer
js/core/photo.js           decodePhoto (browser)
js/core/render.js          renderItem (browser, canvas)
js/core/storage.js         IndexedDB persistence
js/core/export.js          generateAll, shareFiles
js/i18n/index.js, sv.js, ar.js
js/ui/app.js               boot, routing between views
js/ui/views/home.js, batch.js, editor.js, output.js
js/ui/components/*.js      sheet, toast, progress, chip
tests/*.test.js            node --test
```

---

### Task 1: Price model

**Files:** Create `js/core/price.js`, `tests/price.test.js`

**Produces:**
- `parsePrice(input: string) -> { ok: true, ore: number } | { ok: false, reason: 'empty'|'invalid'|'range' }` — `ore` is integer öre.
- `formatPriceParts(ore: number) -> { int: string, dec: string|null }` — `dec` is `null` when öre part is 0, else two digits. `int` uses a thin no-break space for thousands (`1 299`).
- `parseMultiBuy(qty: string, total: string) -> { ok, qty, ore }`.

- [ ] Tests (each an `assert.deepEqual`): `"24,95"`→2495; `"24.95"`→2495; `"24"`→2400; `"24:-"`→2400; `"24,5"`→2450; `" 9,95 kr"`→995; `"٢٤٫٩٥"`→2495; `"۲۴٫۹۵"`→2495; `"1 299,95"`→129995; `""`→empty; `"abc"`→invalid; `"24,955"`→invalid; `"0"`→range; `"100000"`→range. `formatPriceParts(2495)`→`{int:'24',dec:'95'}`; `(2400)`→`{int:'24',dec:null}`; `(129995)`→`{int:'1 299',dec:'95'}`.
- [ ] Run `node --test tests/` → fails (module missing).
- [ ] Implement: map Arabic-Indic (U+0660–0669) and Persian (U+06F0–06F9) digits and `٫` to ASCII; strip `kr`, `:-`, spaces; accept one `,` or `.` separator with 1–2 decimals; range 1 öre … 9 999 999 öre.
- [ ] Run tests → pass. Commit `feat: price parsing and formatting`.

### Task 2: Batch state

**Files:** Create `js/core/batch.js`, `tests/batch.test.js`

**Produces:**
- `createBatch() -> Batch` where `Batch = { colorway: 'rod'|'gron'|'svart', items: Item[] }`, `Item = { id, photoKey, fields, crop }`, `fields = { price:'', unit:'', weight:'', name:'', note:'', mode:'standard'|'nyhet'|'kampanj', oldPrice:'', multiQty:'' }`, `crop = { x:0.5, y:0.5, zoom:1 }`.
- Pure functions returning new batches: `addItem(b, {id, photoKey})`, `removeItem(b, id)`, `moveItem(b, id, toIndex)`, `updateFields(b, id, patch)`, `updateCrop(b, id, patch)`, `setColorway(b, c)`.
- `itemStatus(item) -> 'ready'|'missing-price'|'invalid-price'|'invalid-old-price'`; `readyItems(b)`.
- `UNITS = ['', '/kg', '/st', '/förp', '/liter', '/100g']`.

- [ ] Tests: add keeps order; remove by id; move clamps index; update is immutable (original unchanged); status for empty/invalid/valid price; kampanj with invalid old price → `invalid-old-price`; zoom clamped to 1…4, x/y to 0…1; unknown colorway ignored.
- [ ] Fail → implement → pass → commit `feat: batch state`.

### Task 3: i18n

**Files:** Create `js/i18n/index.js`, `js/i18n/sv.js`, `js/i18n/ar.js`, `tests/i18n.test.js`

**Produces:** `createI18n(lang) -> { lang, dir, t(key, vars) }`; `LANGS=['sv','ar']`; `t` replaces `{n}` vars, falls back to `sv`, then to the key.

- [ ] Tests: default `sv`; `dir` is `rtl` for `ar`; every key in `sv` exists in `ar` and vice versa; interpolation; unknown lang → `sv`.
- [ ] Fail → implement with the full string tables for all four views → pass → commit.

### Task 4: Layout geometry

**Files:** Create `js/core/layout.js`, `tests/layout.test.js`

**Consumes:** `formatPriceParts`.
**Produces:** `computeLayout({ size:1080, fields, priceParts, oldPriceParts, measure }) -> Layout` where `measure(text, {family, weight, size}) -> width` is injected. `Layout = { photo:{x,y,w,h,r}, logo:{…}, badge:{x,y,w,h}, price:{ int:{text,x,y,size}, dec:{…}|null, kr:{…}, unit:{…}|null, old:{…}|null, multi:{…}|null }, name:{text,x,y,size,maxW}|null, note|null, weight|null, modeTag|null }`.

- [ ] Tests with a fake `measure` (width = chars × size × 0.6): price runs stay inside `badge` for `9`, `9,95`, `129,95`, `1 299,95`; int size shrinks monotonically as text grows; `dec` is null for whole prices; name/weight/note null when empty; badge never overlaps logo box; all boxes inside 0…1080.
- [ ] Fail → implement → pass → commit. Exact proportions are tuned after Astra session 2 without changing the interface.

### Task 5: Astra session 1+2 — visual direction (parallel with Tasks 1–4)

**Files:** Create `css/tokens.css`, `docs/design/direction.md`, `docs/design/price-badge.md`

- [ ] Brief Astra (workspace-write, no web search, explicit file list): minimalist native-feeling iOS app language for this brand; deliver tokens (color for 3 colorways + UI light/dark, type scale, radii, spacing, shadows, motion curves/durations) and a written spec of the price badge (shape, proportions of int/dec/kr/unit, per-colorway fills) and the image frame.
- [ ] Review output, record usage %, commit.

### Task 6: Brand assets and fonts

**Files:** Create `assets/brand/logo-full.png`, `logo-mark.png`, `assets/icons/*`, `assets/fonts/*`, `js/config/store.js`

- [ ] Cut logo from `brand/logo-source-facebook.jpeg` (white → alpha with soft threshold; crop mark and full lockup). Inspect results visually.
- [ ] Icons: 180 apple-touch, 192, 512, 512 maskable, on brand background.
- [ ] Download the OFL fonts chosen in Task 5 (woff2, latin + latin-ext + arabic for UI), include licence file.
- [ ] `store.js` exports `STORE = { name, logoFull, logoMark, colorways: { rod, gron, svart } }`. Commit.

### Task 7: Photo decode and renderer

**Files:** Create `js/core/photo.js`, `js/core/render.js`, `dev/render-lab.html`

**Produces:** `decodePhoto(file) -> Promise<{ blob, width, height }>` (JPEG ≤2160 px long edge, orientation applied via `<img>`+`decode()`); `loadRenderAssets() -> Promise<Assets>` (fonts via `FontFace`, logos, frame art; rejects if font fails); `renderItem(canvas, { item, photoBitmap, colorway, assets }) -> void`.

- [ ] Build `dev/render-lab.html`: renders a matrix of sample prices × 3 colorways × 3 modes with a stock photo. Verify in the browser pane; iterate until it looks excellent. Commit.

### Task 8: Storage

**Files:** Create `js/core/storage.js`

**Produces:** `openStore()`, `saveBatch(batch)`, `loadBatch()`, `putPhoto(key, blob)`, `getPhoto(key)`, `deletePhoto(key)`, `clearAll()`, `requestPersistence()`. Quota errors rejected as `{ code:'quota' }`.

- [ ] Implement; verify round-trip in the browser pane console. Commit.

### Task 9: App shell and views

**Files:** Create `index.html`, `css/app.css`, `js/ui/**`

- [ ] Shell: standalone meta tags, `viewport-fit=cover`, safe-area padding, `overscroll-behavior:none`, `-webkit-touch-callout:none`, `user-select:none` (inputs excepted), `touch-action:manipulation`, no tap highlight, 16 px+ inputs (prevents iOS zoom), view transitions.
- [ ] Home: `Ta foto`, `Välj bilder`, language toggle, resume-batch card.
- [ ] Batch: thumbnail grid with ✕, status dot, drag reorder, colorway picker, add-more, `Skapa alla bilder` (disabled with reason when nothing ready).
- [ ] Editor: live preview canvas, pan/pinch on photo only, price field with numeric keypad (`inputmode="decimal"`), unit chips, optional fields in a collapsible section, mode segmented control, prev/next swipe, `Sparat ✓`.
- [ ] Output: progress with cancel, result grid, `Spara i Bilder`, `Dela`, one-by-one fallback, `Ny omgång` (clears batch after confirm).
- [ ] Arabic: mirrored chrome; price/unit inputs and preview forced LTR; free text `dir="auto"`.
- [ ] Verify each view at 390×844 in the browser pane, both languages. Commit per view.

### Task 10: Export and share

**Files:** Create `js/core/export.js`

**Produces:** `generateAll(batch, { onProgress, signal }) -> Promise<File[]>` (sequential; releases each bitmap); `canShareFiles(files)`; `shareFiles(files)` (called directly from a tap handler); filenames `allmat-YYYYMMDD-NN.jpg`.

- [ ] Implement, wire to Output view, verify generation in browser pane. Commit.

### Task 11: PWA

**Files:** Create `manifest.webmanifest`, `sw.js`, update `index.html`

- [ ] Manifest: `display: standalone`, `start_url: "./"`, `scope: "./"`, theme/background colors, icons. iOS splash via `apple-touch-startup-image` for common iPhone sizes.
- [ ] `sw.js`: versioned precache of app shell, cache-first for same-origin GET, `skipWaiting` on message; UI shows `Ny version finns — Uppdatera`.
- [ ] Verify offline reload in browser pane. Commit.

### Task 12: Sol review, Astra polish, deploy

- [ ] Read-only Sol review of the full diff (high effort); fix confirmed findings.
- [ ] Astra session 3: polish review of CSS only, if 5 h usage allows.
- [ ] With the owner's go-ahead: create GitHub repo, push, enable Pages, open URL, run Lighthouse-style checks.
- [ ] Hand the owner the real-iPhone checklist from the spec.
