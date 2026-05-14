# Finalization Audit — v1 one-shot

## What changed in this pass

- Replaced the toy hardcoded app dataset with a typed adapter over `bobiverse_dataset.json`
- Extended app scope from 4 books to all **5** in-scope novels
- Wired spoiler gating through:
  - system visibility
  - event timeline visibility
  - Bob status snapshots in details panel
- Added dataset reference validation (`npm run validate`) and chained it into `npm run build`
- Surfaced dataset caveats and verification queue in the UI/README
- Kept the build static and GitHub Pages-safe (`base: './'`, successful production build)

## Current v1 status

### Done enough for a credible v1
- Static Vite app builds successfully
- Core interaction loop exists: spoiler gate -> map -> list -> details -> timeline
- Lore seed is actually integrated into the product now
- Five-book scope is represented in the app and dataset
- Basic release documentation exists

### Still not fully canon-locked
- Spatial layout is only partially real; many systems use synthetic render positions because no canonical 3D coordinates are present
- Dataset remains conservative and not exhaustive
- Some late-book/book-5 and factional details still carry `medium`/`low` certainty

## Must-fix before calling release "done"

### Builder / product
1. **Persist spoiler preference locally**
   - Right now the ceiling resets on refresh.
   - Use `localStorage` so Pages users do not re-answer every visit.

2. **Add deployment workflow and screenshots**
   - Missing GitHub Actions / Pages automation.
   - README should include at least one screenshot or gif.

3. **Reduce JS bundle size**
   - Current production JS is ~534 kB minified.
   - Not a blocker for internal preview, but a real polish issue for public Pages/mobile.
   - First easy move: split the Three.js scene/init from panel rendering or lazy-load detail-heavy panels.

4. **Make child locations a product decision**
   - `Quin` and `Heaven's River` are in the dataset but not separate selectable scene nodes.
   - For v1, either:
     - keep them embedded in Eta Leporis and state that clearly, or
     - render them as child markers.
   - Do not leave this ambiguous.

### QA / content
1. **Burn down `open_questions_for_text_verification`**
   - Anything still unresolved should either be verified against the novels or downgraded/hidden from prominent display.

2. **Regression-test spoiler consistency**
   - For each ceiling 1..5, verify that:
     - later-book systems disappear
     - later-book events disappear
     - Bob status cards do not leak later-book information

3. **Check timeline semantics**
   - Some events use `year`, `month`, `day`, `decade` precision.
   - QA should confirm the date display is acceptable and not falsely over-precise.

4. **Mobile touch test on real hardware**
   - Must validate:
     - panel open/close behavior
     - drag vs click selection reliability
     - wheel/zoom fallback expectations on touch devices

## Strongly recommended next pass

- Add route/relationship overlays between systems once canonical travel links are curated
- Add certainty badges to the left-panel timeline, not only details
- Add a compact "book coverage" summary card so users can see where the seed is thin
- Add a small inline legend note that some positions are synthetic render placements

## Release call

This is now a **real, integrated beta-quality v1 candidate**, not just a planning shell.

If you want the next worker wave to be efficient, split it cleanly:
- **Content QA worker:** novel verification + certainty cleanup
- **Frontend finisher:** localStorage, bundle trim, screenshots, Pages workflow
- **UX QA:** mobile/touch regression and spoiler-ceiling walkthrough
