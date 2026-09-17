# Fixed export composition

All coordinates are intrinsic pixels on a 1080 × 1080 canvas; origin is top-left. Export JPEG on an opaque background. Resolve the `--image-{red|green|black}-*` CSS token values before drawing; UI appearance never changes export colors. Load actual font weights and await font readiness before measuring or exporting. Artwork is always Swedish and LTR.

## Geometry and drawing order

1. Fill the canvas with `paper`. Draw an inside rectangular frame in `frame`: 20px on all four sides, square outside corners. For Grön only, increase the left and right frame widths inward to 32px; photo coordinates remain unchanged.
2. Photo slot: x=48, y=144, w=984, h=590, radius=22. Draw the complete, orientation-corrected source with centered **contain**, on white, clipped to the rounded slot. Never stretch or automatically crop a product. Unfilled areas remain white. No badge, copy, or ornament enters this slot.
3. Ornament layer: clip to the header x=272, y=36, w=760, h=92 and the lower-left area x=48, y=750, w=392, h=282. Draw behind all remaining elements.
4. Logo plate: x=48, y=40, w=208, h=88, radius=12, fill `--image-logo-plate`. Fit the supplied AV logo proportionally inside x=60, y=48, w=184, h=72. Preserve brand colors, remove no logo details, and never distort or recolor it. The plate and padding remain fixed.
5. Price badge: x=456, y=752, w=576, h=280, radius=42, rotation **0°**. Shadow: color `--image-shadow`, blur=16, offset=(0,6); draw shadow first, then opaque `badge` fill and an inside 6px `badge-stroke`. Clip badge content to its interior. Keep this rectangle identical for every price, mode, and colorway.
6. Draw metadata and price content as below. All text uses exact bounding-box measurement, not estimated character widths.

## Price lettering and fit

Use Barlow Condensed 900, normal tracking, tabular numerals where available. Integer cap height C is the measured ink height of “0” at the selected integer font size. Decimals use 0.48C, “kr” 0.22C, and unit 0.22C **ink heights**, all in Barlow Condensed 700 except decimals at 900; calculate their font sizes by measurement. Do not confuse CSS font size with ink height.

Integer font-size range: 96–208px. Decimal/kr/unit sizes are derived, not independently shrunk; with measured font metrics their limits are the ratios above applied to C(96) and C(208). Use the largest integer size that satisfies every width and height constraint below. Search downward in 1px increments, or binary-search then floor. Test at least 9, 24,95, 999,95, and 1 299,95.

Format the integer with a nonbreaking space for thousands. Place two decimals, when present, raised to align their ink top with the integer ink top; omit the comma in this superscript treatment. Whole prices omit decimals entirely (do not invent “00” or “:–”). Place “kr” after the integer when no decimals exist; otherwise place it in the decimals' column, below decimals with an 8px gap. The shared column width is max(decimal width, kr width). Gap from integer to column is 0.055C; no gap is reserved for absent decimals.

Main row ink bounds must fit x=484…1004 (520px width). Center the full row horizontally in that interval, including the decimal/kr column. Unit, when present, is a centered separate row, 10px below the main row; use exactly /kg, /st, /förp, /liter, or /100g. Without unit, reclaim its row and gap.

The current-price block (main row plus optional unit) fits y=788…1008 normally. With an old price, it fits y=826…1008. Center its measured ink bounds vertically within the relevant interval. Fit against both the available width and total block height. Use actualBoundingBoxAscent/Descent to convert these ink coordinates into Canvas baselines. All current-price lettering uses `price`. If unsupported input still cannot fit at 96px, require correction before export; never clip, truncate, or move the badge.

## Optional elements and collapse

**Mode:** Standard draws nothing. Nyhet/Kampanj draws a header pill with right edge x=1032, y=58, h=52, radius=26, horizontal padding=22. Text “NYHET”/“KAMPANJ”: Barlow Condensed 700, 30px, centered vertically using ink bounds; fill `tag`, text `tag-ink`. Width is measured text plus 44px. Header logo never moves.

**Lower-left stack:** x=48, top y=758, maximum width=384, bottom limit y=1024. Draw only present elements in order: weight, name, comment. Gaps between present elements are 14px. Empty elements and their gaps consume zero height; the next present element starts at y=758. This stack never expands into the badge.

**Weight:** pill h=48, radius=24, width=measured text+32, maximum 384. Noto Sans Arabic 700, 26px, `weight-ink` on `weight`; 16px horizontal padding. Input limit 16 characters; shrink to 20px if necessary, then flag overflow before export.

**Name:** Barlow Condensed 700, 44px, `ink`, maximum two lines with 48px line boxes (96px total). Wrap at spaces; reduce to 34px if needed for an unbroken word. Remaining overflow gets an ellipsis and a visible editor warning so the user can shorten it.

**Comment:** Noto Sans Arabic 500, 24px, `muted`, maximum two 36px line boxes (72px total). Wrap at spaces; use ellipsis plus editor warning on overflow. These maxima plus weight and both gaps total 244px, within the 266px stack area. Set baselines from measured ink metrics so Arabic-family Latin glyphs are never clipped.

**Old price:** optional and only rendered in Kampanj. Center within x=484…1004, y=774…812; Barlow Condensed 600, 30px, same `price` ink, Swedish inline notation such as “Ord. 39,95 kr”. Use no unit here. Fit down to 24px as needed; reject overflow. Draw a 2px line through only the numeric price and currency at the vertical middle of their ink bounds. Its presence changes the current-price content interval; absence reclaims it even in Kampanj. Ignore any stored old-price value in Standard/Nyhet. Validate old price exceeds current price.

## Exact colorway mapping

Every row references tokens declared in `css/tokens.css`; no implicit tint or opacity applies to text, fills, or strokes.

| Role | Röd | Grön | Svart |
|---|---|---|---|
| Paper | --image-red-paper | --image-green-paper | --image-black-paper |
| Frame | --image-red-frame | --image-green-frame | --image-black-frame |
| Badge fill | --image-red-badge | --image-green-badge | --image-black-badge |
| Badge inside stroke | --image-red-badge-stroke | --image-green-badge-stroke | --image-black-badge-stroke |
| Price / old price | --image-red-price | --image-green-price | --image-black-price |
| Name | --image-red-ink | --image-green-ink | --image-black-ink |
| Comment | --image-red-muted | --image-green-muted | --image-black-muted |
| Mode pill | --image-red-tag | --image-green-tag | --image-black-tag |
| Mode lettering | --image-red-tag-ink | --image-green-tag-ink | --image-black-tag-ink |
| Weight pill | --image-red-weight | --image-green-weight | --image-black-weight |
| Weight lettering | --image-red-weight-ink | --image-green-weight-ink | --image-black-weight-ink |
| Ornament pigment | --image-red-ornament | --image-green-ornament | --image-black-ornament |

Weight pills have a 2px inside stroke in `frame` in all variants; mode pills have no stroke. Photo slot and logo plate have no stroke. Röd makes the solid red price field the focal point; Grön uses the heavier green frame and green supporting labels around a white, green-outlined badge with red figures; Svart uses black and white with the original full-color logo as its only colored mark.

## Optional raster ornaments

These are transparent PNG overlays, never substitutes for the real product, logo, or lettering. Export remains complete without them; no random placement. Knock out ornament pixels beneath metadata rectangles plus 12px padding and beneath the mode pill plus 12px padding.

**Röd:** Depict two broad, imperfect produce-crate stamp arcs, using only `--image-red-ornament`, with no words, seals, numbers, or recognizable products. Fit in header x=680, y=40, w=352, h=88 at 8% layer opacity; keep the lower-left area empty.

**Grön:** Depict a sparse line drawing of two leaf sprigs, echoing the AV leaf accents without copying or extending the logo. Fit in lower-left x=48, y=750, w=392, h=282 at 7% layer opacity using `--image-green-ornament`; keep the header empty.

**Svart:** Depict three fine, slightly irregular parallel engraved lines, like a restrained paper impression, with transparent space between them. Fit in header x=440, y=40, w=592, h=88 at 6% layer opacity using `--image-black-ornament`; no metallic texture, gradients, or lower-left decoration.
