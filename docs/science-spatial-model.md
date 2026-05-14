# Science / Spatial Model for `bobiverse-interactive-map`

This document defines a physically sane but UI-friendly spatial model for a Bobiverse galaxy map.

## 1. Scope and realism level

Use **real astronomical positions and distances where known**, especially for nearby named stars. For fictional or uncertain Bobiverse locations:

1. Keep the star/system name and canon metadata.
2. If the target is a real star, anchor it to real coordinates.
3. If the target is fictional or ambiguous, place it in a **clearly marked inferred/plausible** position with provenance.
4. Never mix "canon jump distance" and real Euclidean distance without labeling the difference.

## 2. Canonical spatial frame

Use a right-handed **heliocentric Cartesian frame in light-years** for app data and rendering.

- **Origin:** Sol / Sun = `(0, 0, 0)`
- **Units:** light-years (ly)
- **Axes:**
  - `+X` = toward the Galactic Centre
  - `+Y` = direction of Galactic rotation
  - `+Z` = North Galactic Pole

This is effectively a local Galactic Cartesian frame centered on Sol. It is intuitive for a Milky Way map and stable for distance math.

## 3. Source-of-truth coordinate formats

Store source coordinates in the most traceable form available:

- Preferred source fields:
  - `distance_ly`
  - `ra_deg`
  - `dec_deg`
  - `galactic_longitude_deg` (`l`)
  - `galactic_latitude_deg` (`b`)
  - source catalog / citation
- Derived render fields:
  - `x_ly`, `y_ly`, `z_ly`

### Recommendation

If a source provides RA/Dec + distance, convert once during a build/data-prep step.
If a source provides Galactic `l/b + distance`, prefer that because it maps directly onto the app frame.

## 4. Transform conventions

### 4.1 Galactic spherical -> local Galactic Cartesian

Given:
- distance `r` in ly
- galactic longitude `l` in degrees
- galactic latitude `b` in degrees

Compute:

- `x = r * cos(b) * cos(l)`
- `y = r * cos(b) * sin(l)`
- `z = r * sin(b)`

where angles are converted to radians first.

This makes:
- Galactic Centre direction = positive X
- rotation direction = positive Y
- north of the galactic plane = positive Z

### 4.2 Equatorial (RA/Dec) -> local Galactic Cartesian

Do this in two steps:
1. Convert RA/Dec/distance to equatorial Cartesian.
2. Rotate into Galactic coordinates using the standard IAU/J2000 transform.

For this project, do that offline in data prep, not per frame in the browser.

## 5. Precision and uncertainty

For a Bobiverse app, you do **not** need sub-AU precision.

Recommended tolerances:
- Nearby stars (< 100 ly): show distances to 0.1 ly or 0.01 ly in data, but round UI display sensibly.
- Mid-range systems (100-5000 ly): 1 ly precision is usually enough for rendering/UI.
- Large Milky Way context: 10-100 ly precision is visually fine.

Every system should carry:
- `position_quality`: `measured | inferred | fictional | approximate`
- `distance_uncertainty_ly` (nullable)
- `source`

That matters more than fake precision.

## 6. Recommended data model

Each star/system record should contain:

```ts
interface SystemRecord {
  id: string;
  name: string;
  aliases?: string[];
  isCanon: boolean;
  faction?: string;
  status?: string;
  era?: {
    fromYear?: number;
    toYear?: number;
  };
  sourcePosition: {
    frame: 'galactic' | 'equatorial' | 'cartesian';
    distanceLy?: number;
    raDeg?: number;
    decDeg?: number;
    galacticLongitudeDeg?: number;
    galacticLatitudeDeg?: number;
    xLy?: number;
    yLy?: number;
    zLy?: number;
    source: string;
    sourceUrl?: string;
    positionQuality: 'measured' | 'inferred' | 'fictional' | 'approximate';
    distanceUncertaintyLy?: number;
  };
  renderPosition: {
    xLy: number;
    yLy: number;
    zLy: number;
  };
}
```

## 7. Milky Way representation

Do **not** attempt a full star catalog at first. That will add load and clutter without improving the Bobiverse story.

Use 3 spatial layers:

### Layer A: Story systems
The named systems relevant to plot and timeline. These are fully interactive.

### Layer B: Reference stars / landmarks
A sparse set of real, recognizable systems for orientation:
- Sol
- Alpha Centauri
- Sirius
- Epsilon Eridani
- Tau Ceti
- 82 G. Eridani
- Vega
- Arcturus
- Polaris (optional; visually useful, not local)
- notable nearby bright stars used in canon or fan context

### Layer C: Background galaxy context
Use a procedural/texture-based Milky Way disk and bulge, not millions of actual stars.

This gives plausibility at a fraction of the cost.

## 8. Scale strategy for rendering

Real space is brutally sparse. A literal 1:1 visual scale is technically possible but often terrible UX.

Use **data scale = real ly**, but allow **view-dependent presentation aids**:

1. **True coordinate mode**
   - All positions remain physically correct.
   - Default for measurements, tooltips, route lines, and distance calculations.

2. **Visual assist mode**
   - Increase star sprite size with distance-independent screen-space sizing.
   - Optionally exaggerate labels and selection halos.
   - Never move systems off their true coordinates just to make clusters prettier.

3. **Galaxy overview mode**
   - Show a downscaled positional cloud or thin disk haze.
   - Fade small-scale labels.

The important line: **fake sizes, not fake distances**.

## 9. Camera/navigation realism

### Good defaults
- Perspective camera with large far plane.
- Orbit controls around a selected focus target.
- Pan speed scaled to current focus distance.
- Smooth logarithmic zoom behavior.

### Strong recommendation
Use **focus-relative navigation** rather than free-flying from the origin forever.

That means:
- Camera has a current target system.
- Distances and movement are interpreted relative to target.
- Jumping from Sol to a distant system recenters the experience without changing the underlying data.

### Why
Three.js uses 32-bit GPU precision in many places. Huge absolute world coordinates can produce jitter.

### Practical rule
When focusing a system, subtract that system's position from all rendered objects in the scene graph or move a parent container so the focused object sits near `(0,0,0)` in render space.

That keeps:
- physics/data in true ly
- rendering numerically stable
- camera controls intuitive

## 10. Precision / floating-origin policy

Recommended:
- Keep source data in `number` values measured in ly.
- For rendering, use a **floating origin** centered on the current focus system.
- Rebuild or offset scene coordinates when focus changes materially.

This matters if users can jump between Sol, local neighborhood stars, and far-galaxy viewpoints.

## 11. Distance display conventions

Use:
- ly for interstellar distances
- AU only for intra-system views if those are ever added
- kly for > 1000 ly overview labels

Examples:
- `4.37 ly`
- `12.1 ly`
- `2.4 kly`

If you show travel/jump lines, calculate from true 3D Euclidean coordinates:

`distance = sqrt((dx)^2 + (dy)^2 + (dz)^2)`

## 12. Timeline + space

Because the app has a timeline, a system's position should be mostly time-invariant on story timescales.

Reason: proper motion over centuries is real, but tiny for this UX unless you deliberately want a "stellar drift" mode.

Recommendation:
- Keep a fixed present-epoch coordinate set (J2000 or Gaia-era approximation).
- Ignore proper motion in v1.
- If later desired, add optional drift only for nearby stars and clearly label it as astronomical motion, not lore movement.

## 13. Performance-aware representation

### Keep interactive objects sparse
For named systems, a few hundred objects is trivial.

### For background stars
Use one of:
- `THREE.Points` with a single `BufferGeometry`
- baked skybox / emissive disk texture
- impostor sprites for a curated landmark set

### Avoid
- one mesh per background star at large counts
- per-frame recalculation of coordinate transforms
- text labels for every visible object

### Nice compromise
- interactive story nodes as individual objects
- reference stars as lightweight points
- galaxy disk as one or two planes / particles / volumetric impostors

## 14. Recommended file pipeline

### Authoring layer
Humans edit a JSON/TS file with traceable astronomy inputs and citations.

### Build-prep layer
A script converts source positions into app-ready Cartesian `x/y/z` in ly.

### Runtime layer
The app reads already-normalized data and only does:
- filtering
- timeline visibility
- culling
- camera-relative transform

This is cleaner and faster than doing astronomy math in the render loop.

## 15. What to do for ambiguous Bobiverse locations

For any canon system whose real-world counterpart is unclear:

- add `canonName`
- add `realWorldCandidate` if any
- set `positionQuality: 'inferred'`
- explain reasoning in a note/provenance field

Never silently "make up" a precise coordinate.

## 16. Minimal starter landmark set

Start with these as scientific anchors if the lore uses or references them:
- Sol
- Alpha Centauri A/B / Proxima Centauri (can be collapsed to one system node)
- Sirius
- Epsilon Eridani
- Tau Ceti
- 61 Cygni
- Epsilon Indi
- Wolf 359
- Lalande 21185
- Vega

These cover recognizable local-space navigation well.

## 17. Bottom-line implementation advice

If I were building this, I would do the following:

1. Adopt **heliocentric Galactic Cartesian coordinates in ly** as the single canonical render/data frame.
2. Convert real astronomy source data offline.
3. Track provenance and uncertainty for every system.
4. Keep positions physically true, but use nonphysical sprite/label sizes for readability.
5. Use **floating-origin recentering** for camera stability.
6. Use sparse interactive story systems plus cheap background galaxy context.

That gives you realism where it matters without turning the app into a broken planetarium.
