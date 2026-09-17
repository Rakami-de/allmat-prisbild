# Allmat Prisbild

A quiet workbench for a shopkeeper, with the confidence of a familiar grocery sign. Soft white surfaces and deep green actions let product photography carry the interface; condensed, heavyweight prices give the exported artwork its retail energy. Every screen should make the next useful step feel immediate.

## Layout and controls

Use one vertical column, 20px side gutters, 24–32px between sections, and the iOS safe areas. Limit content to 560px; keep the primary action above the bottom safe area or keyboard without covering scrollable content. Use 17px UI text, sentence case, generous line height, and Dynamic Type-friendly wrapping; never enforce fixed text-container heights.

Use Barlow Condensed 900 for Swedish headings and prices; Noto Sans Arabic 400–700 for all interface labels and body text, and 900 for Arabic headings. Arabic gets 1.7 line height and no tracking. Avoid tightly packed uppercase outside export tags.

Buttons: one filled green primary, 56px minimum height, 16px corners; secondary actions use a surface and visible control border. Home gives “Ta foto” the filled treatment and “Välj bilder” an equally large outlined treatment. Resume appears below. Press states darken subtly; show text alongside icons. Disabled actions explain the missing requirement nearby.

Inputs: persistent labels, 52px minimum height, 16px padding, visible control border. Price uses 56px type and a decimal keypad; keep “Klar” available above the keyboard. Accept comma or point and format Swedish decimals after editing. Errors appear inline with an icon and explanation.

Chips: 44px minimum targets, text labels, selected tint plus checkmark. Label the no-unit option “Ingen”. Colorway swatches always include Röd/Grön/Svart and an outer selection ring with checkmark. Segmented mode control uses a muted track and solid selected surface; use three stacked options when translation or text size cannot fit.

Thumbnail cards: square crop, 16px corners, 12px gaps, three columns normally and two at large text sizes. Put remove in a 44px corner target. Pair ready/missing dots with a check/exclamation and visible status below; completed cards also show price.

Sheets: opaque raised surface, 30px top corners, grabber, explicit close, scrollable contents. Toasts: brief nonblocking confirmations above the action bar; persistent inline errors for failures. Progress: determinate bar plus “4 av 12 klara”; preserve completed results and offer retry for failures. Output uses “Spara i Bilder” as primary where supported, with “Dela” secondary; describe actual save/share behavior accurately.

## Motion and direction

Press feedback: 100ms. Selection and preview crossfades: 160ms, ease-out. Screen transitions: 240ms ease-out, maximum 12px travel; sheets: 320ms ease-out. Progress interpolates for 160ms ease-in-out. Reduced motion removes travel, scaling, and decorative animation; use immediate state changes. Announce progress milestones accessibly.

RTL mirrors navigation, alignment, grids, and directional arrows using logical properties. Isolate prices and numeric entry LTR; keep export preview and artwork Swedish/LTR. Language choices read “Svenska” and “العربية”.

## Never

- Add gradients or translucent glass panels.
- Use red as the routine primary UI action.
- Convey state through color alone.
- Hide essential actions behind gestures.
- Animate continuously or decorate empty space without purpose.
