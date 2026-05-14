# Delivery Plan

## Guiding Principle

Ship a **tight, performant explorer** rather than an overbuilt lore database.

## Workstreams

### 1) Foundation
**Owner profile:** app/platform worker

Deliverables:
- Vite + TypeScript baseline configured for GitHub Pages
- Three.js render loop scaffold
- Responsive app shell
- CI/build sanity check

Exit criteria:
- `npm run build` succeeds
- Static build works under GitHub Pages base path
- Basic mobile viewport layout exists

---

### 2) Data Model + Content Pipeline
**Owner profile:** data/content worker

Deliverables:
- JSON schemas/types for books, systems, bobs, events, links/routes
- Source-of-truth files in `src/data/`
- Validation helper script or runtime guard
- Initial seed content for all 5 books

Exit criteria:
- Every event references valid entities
- Book IDs are consistent across filters/timeline/map
- Coordinates and dates are normalized and documented

---

### 3) 3D Map Experience
**Owner profile:** Three.js/UI worker

Deliverables:
- Camera, scene, star/system markers, interaction states
- Selection/focus behavior
- Lightweight labels/tooltips/cards
- Mobile-safe navigation controls

Exit criteria:
- Tap/click selection works reliably
- Camera transitions are smooth
- Performance remains acceptable on mid-range mobile

---

### 4) Timeline + Exploration UX
**Owner profile:** product/frontend worker

Deliverables:
- Time scrubber or time-range controls
- Event list/card synchronized with map selection
- Search and multi-filter panel
- Spoiler warning + per-book visibility settings

Exit criteria:
- Hiding a book removes its events/routes/details consistently
- Search results can drive map focus
- Timeline and map stay in sync without confusing state

---

### 5) Polish, QA, Deploy
**Owner profile:** finisher/release worker

Deliverables:
- Visual theme pass
- Loading/empty/error states
- Performance optimization pass
- README and deployment docs
- GitHub Pages release

Exit criteria:
- Lighthouse/perceived performance is reasonable for static 3D
- No broken references in dataset
- Final site works on common mobile and desktop widths

## Milestones

### M0 — Project Skeleton
- Repo bootstrapped
- Branch strategy set
- Planning docs committed

### M1 — Vertical Slice
A tiny but real path through the app:
- 3-5 systems
- 1-2 books represented
- map + timeline + selection + spoiler toggle all connected

**Why this matters:** proves the architecture before content bulk lands.

### M2 — Full Content Integration
- All 5 books represented in the schema
- Filters/search stable
- 3D interactions complete

### M3 — Beta Polish
- Visual pass
- Mobile tuning
- Performance pass
- Content QA

### M4 — Release
- GitHub Pages live
- README/screenshots/final notes updated

## Recommended Task Order

1. Create typed data contracts before UI complexity grows
2. Build a vertical slice early
3. Expand content only after interaction/state model feels right
4. Reserve the last 15-20% for polish and optimization

## Risks and Mitigations

### Risk: scope creep into lore encyclopedia
Mitigation: every screen element must support map/timeline exploration.

### Risk: data inconsistencies across books/events/bobs
Mitigation: central typed IDs, validation checks, documented conventions.

### Risk: poor mobile usability in 3D scene
Mitigation: test touch interactions from the first map MVP; do not wait for polish.

### Risk: GitHub Pages path/deploy issues
Mitigation: configure base path early and validate deployment before feature-complete stage.

### Risk: spoiler logic becomes leaky
Mitigation: treat hidden books as a first-class visibility layer across cards, search, timeline, and map.

## Definition of Ready for Workers

A worker task should be considered ready only when it includes:
- target files/folders
- acceptance criteria
- known constraints
- whether it may reshape the data schema

## Definition of Done for PRs

- Narrow scope
- Clear before/after summary
- Build passes
- No obvious regressions in mobile layout or map interaction
- Notes included for follow-up work if not fully complete
