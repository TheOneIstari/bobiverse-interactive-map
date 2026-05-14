# bobiverse-interactive-map

Spoiler-aware static Bobiverse explorer for GitHub Pages.

## Current v1 shape

- 5-book scope wired in: **We Are Legion**, **For We Are Many**, **All These Worlds**, **Heaven's River**, **Not Till We Are Lost**
- 3D system map with click/tap selection
- Timeline/event panel driven by the canonical seed JSON
- Bob activity/status summaries by book
- Spoiler ceiling applied across systems, event timeline, and Bob status cards
- Conservative canon dataset with certainty labels and a visible verification queue

## Data source of truth

- `bobiverse_dataset.json` is the canonical lore seed
- `src/data/bobiverse.ts` adapts and normalizes that JSON for the UI
- `src/data/referenceSystems.ts` contains measured/approximate spatial anchors used when real positions are available
- Synthetic map placement is used for canon locations that lack explicit coordinates; these are fine for v1 navigation but should not be presented as exact canon cartography

## Scripts

```bash
npm install
npm run validate
npm run dev
npm run build
```

`npm run build` now validates dataset references before compiling.

## GitHub Pages notes

- Vite base is `./`, so the build is portable for repo-hosted Pages deployments
- Publish the `dist/` folder contents
- If moving to a custom domain or stricter Pages workflow later, keep the app static and avoid server-side routing

## Known v1 caveats

- The lore dataset is intentionally conservative rather than exhaustive
- Many systems still use synthetic render positions because the books do not provide a full canonical 3D coordinate catalogue
- `open_questions_for_text_verification` should be burned down before calling the content fully canon-locked

## Priority follow-up for builder/QA

1. Verify late-book/book-5 event wording directly against the novel where certainty is below `high`
2. Add screenshots and a Pages deployment workflow
3. Test mobile interaction and panel behavior on a real phone/tablet
4. Decide whether child locations like **Quin** and **Heaven's River** should become distinct selectable scene nodes in v1.1
