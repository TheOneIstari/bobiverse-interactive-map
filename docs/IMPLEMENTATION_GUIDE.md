# Implementation Guide

## Suggested Folder Intent

```text
src/
  components/   UI panels, cards, controls
  data/         JSON files + typed adapters
  styles/       theme tokens, layout, component styles
  utils/        filtering, search, timeline transforms, math helpers
```

Recommended additions:

```text
src/
  scene/        Three.js scene setup, camera, controls, picking, render helpers
  store/        app state / derived selectors
  types/        shared TypeScript entity contracts
  assets/       static icons/textures if needed
```

## Suggested Core Entities

### `books.json`
- `id`
- `title`
- `order`
- `shortLabel`
- `color`
- `spoilerLevel` (same as order unless a better rule is needed)

### `systems.json`
- `id`
- `name`
- `x`, `y`, `z`
- `category` (`sol`, `human`, `colony`, `other`, etc.)
- `bookIds`
- `summary`

### `bobs.json`
- `id`
- `name`
- `generation`
- `aliases`
- `bookIds`
- `summary`

### `events.json`
- `id`
- `year`
- `bookId`
- `systemId`
- `bobIds`
- `title`
- `summary`
- `tags`
- `route` (optional `{ fromSystemId, toSystemId }`)

## State Model Guidance

Keep global state compact:
- selected system/event/bob
- visible books
- active filters
- search query
- timeline range or active year
- camera target/focus

Avoid duplicating derived state. Compute filtered views from source data + controls.

## UX Rules

1. **Spoiler control comes first** on initial load.
2. **Map, timeline, and detail panel share one selection model.**
3. **Search should return mixed entity types** (system, bob, event) but present them clearly.
4. **Mobile mode should favor bottom sheets/drawers** over always-open sidebars.
5. **Details should stay concise**; this is an explorer, not a wiki.

## Performance Guidance

- Start with a modest number of rendered objects and scale carefully.
- Use simple geometry/materials first.
- Batch or instance repeated markers if counts grow.
- Avoid expensive label rendering for all objects at once.
- Debounce search/filter recomputation if needed.
- Keep animation subtle; don’t burn frames on decorative effects.

## GitHub Pages Notes

- Confirm bundler base path early.
- Keep assets static and relative-path friendly.
- Prefer client-only app state stored locally if persistence is needed.

## Quality Bar for the Content Dataset

Before calling content "done":
- each event is attributed to a visible book
- each system referenced by an event exists
- each bob referenced by an event exists
- event years follow a consistent convention
- spoiler filtering actually hides downstream content
