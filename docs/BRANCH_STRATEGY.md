# Repo and Branch Strategy

## Baseline

- Default branch: `main`
- Deploy branch: `gh-pages` (or GitHub Pages action targeting Pages artifact)
- Protect `main` conceptually: merge only buildable, reviewable increments

## Recommended Branches

### Long-lived coordination branches
- `main` — stable integration branch
- `release/gh-pages` — optional only if deployment needs a staging branch; otherwise skip it

### Short-lived feature branches
Use small, focused branches:
- `feat/foundation-vite-three`
- `feat/data-schema-seed`
- `feat/map-vertical-slice`
- `feat/timeline-sync`
- `feat/search-filters`
- `feat/spoiler-controls`
- `feat/mobile-polish`
- `feat/perf-pass`
- `docs/planning`

## Merge Order

1. `docs/planning`
2. `feat/foundation-vite-three`
3. `feat/data-schema-seed`
4. `feat/map-vertical-slice`
5. `feat/timeline-sync`
6. `feat/search-filters`
7. `feat/spoiler-controls`
8. `feat/mobile-polish`
9. `feat/perf-pass`

## PR Rules

- One concern per PR
- Prefer 200-500 line reviewable chunks over giant dumps
- If schema changes, call it out explicitly in PR title/body
- Include screenshots/gifs for UI-visible changes when possible
- Rebase or merge `main` frequently to avoid content/schema drift

## Commit Conventions

Suggested prefixes:
- `feat:` new user-facing functionality
- `fix:` bug fix
- `refactor:` internal cleanup without behavior change
- `data:` dataset/content changes
- `docs:` planning or documentation
- `perf:` performance work
- `chore:` tooling/config

## Coordination Notes

- The data schema branch should land before broad content authoring.
- The first map branch should target a vertical slice, not the whole galaxy dataset.
- Performance work should be iterative, but reserve one explicit cleanup branch near release.
- Keep content-only commits separable from rendering logic when possible.
