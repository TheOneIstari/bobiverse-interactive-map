# Science Finalization Notes

## What changed

### 1. Replaced decorative placeholder placement for top-level systems
Previously, systems without a hardcoded reference could end up on a hashed synthetic cloud. That looked fine, but it was not spatially trustworthy.

Now:
- real/canon systems tied to known stars are anchored through `src/data/referenceSystems.ts`
- inferred placements preserve stated Sol distance and mark provenance explicitly
- child locations like Heaven's River are kept near the parent star with tiny, explicitly non-astronomical offsets for UI separation only

### 2. Separated true coordinates from scene coordinates
`SystemEntry` now carries:
- `x/y/z` = true data coordinates in ly
- `sceneX/sceneY/sceneZ` = navigation-friendly scene coordinates
- `trueDistanceFromSolLy`
- `positionQuality`, `positionSource`, `distanceUncertaintyLy`, `positionNotes`

This means the app can remain honest about the data while still being usable.

### 3. Added far-field compression policy
For scene usability only, radii beyond 250 ly are logarithmically compressed.

Important:
- measurements and displayed coordinates should use true `x/y/z`
- the scene uses compressed coordinates only for overview navigation
- this especially matters for the Sagittarius A* region marker (~26 kly)

## Spatial conventions confirmed

- Data frame: heliocentric local Galactic Cartesian
- Units: light-years
- Origin: Sol = `(0, 0, 0)`
- Axis mapping into Three.js scene:
  - scene.x = galactic +X
  - scene.y = galactic +Z
  - scene.z = galactic +Y

That keeps the galactic plane readable while using Three.js' conventional "up" axis.

## Remaining recommendations

1. Add a dedicated build-time astronomy prep script if the dataset grows.
2. If floating-origin focus navigation is added later, keep data coordinates unchanged and recenter only the rendered group.
3. Before claiming catalog-grade accuracy, replace approximate local-star galactic coordinates with cited Gaia/SIMBAD-derived values.
4. Consider a toggle later:
   - local true-scale mode
   - galaxy overview mode

## Known caution

Some anchors are still labeled `approximate` rather than `measured`. That's deliberate and better than false precision.
