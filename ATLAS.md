# TRIScore 4.1 — Manifold Atlas

This is a release of the **TRIScore 4.0 Chaos Topology / Tris Native source line**. It does not replace or combine the separately named Element Forge, Triscore Link, or Nocturne executable branches: their complete source was not available locally. All 49 scripts from the available 4.0 workbench are retained byte for byte. The original HTML files remain in the source package for reference.

## Explore

Open **Atlas** in the navigation rail, **Enter Manifold Atlas** on the home screen, or search the global command palette for Calabi–Yau, Atlas, manifold, Colabi-Yow, or kolabiyow. Windows launches directly into the atlas.

- Choose the Fermat quintic threefold, Fermat quartic K3 surface, or Fermat cubic elliptic curve. Search accepts spelling aliases but titles and exports use Calabi–Yau.
- Drag to rotate, scroll to zoom, or focus the canvas and use arrow keys, plus/minus, and Home. Auto orbit is opt-in. Sentinel pauses orbit. Hidden pages do not render frames.
- Adjust the radial chart domain, fixed complex coordinate magnitude/phase (quintic and K3), two projection angles, sampling resolution, and displayed root branch. Select surface, wireframe or point rendering.
- Save a view or capture an experiment with its title, notes, full chart recipe and camera. Both are reproducible snapshots; experiments also participate in the same comparison/export workflow. Restore pauses orbit for a stable view.
- Compare two saved recipes. Append the current experiment to the existing Field notes notebook without replacing earlier writing. The notebook retains its 20,000-character limit.
- Export selected snapshots or the whole atlas as JSON. PNG exports include the interpretation caveat. Imports validate before review and merge only new record IDs. Review does not itself modify storage.

## What is calculated

For degree n = 5, 4, or 3, sample z₁ = r exp(iθ) and solve all n complex roots of

`z₂ⁿ = −1 − z₁ⁿ − cⁿ`.

For the quintic in CP⁴ we fix Z₀=1, Z₃=c, Z₄=0. For the quartic in CP³ we fix Z₀=1, Z₃=c. For the cubic in CP² we fix Z₀=1, with no c coordinate. This leaves a real two-dimensional chart sample described by four real coordinates. Two plane rotations followed by dropping one coordinate give the displayed R³ projection; the camera then adds perspective for the screen.

The mesh samples a bounded annulus, omits points at infinity, and suppresses long edges across root branch cuts. Its gaps and overlapping projected sheets are display artifacts, not inferred holes or singularities. Triangles interpolate sampled roots; only the vertices are checked against the polynomial. Residual is the maximum absolute polynomial error on those vertices, not a metric error or proof of coverage.

The topology cards describe the **smooth compact parent manifold**, not the sampled mesh. Controls do not compute new Hodge or Betti numbers. No Ricci-flat metric, full 6D reconstruction, global atlas coverage, moduli-space solver, mirror construction, or physical string simulation is included. The elliptic curve uses the broad trivial-canonical-bundle meaning of Calabi–Yau; definitions imposing simple connectivity exclude it.

| Parent | Complex / real dimension | Hodge data shown | Euler | Betti numbers |
|---|---|---|---|---|
| Smooth quintic in CP⁴ | 3 / 6 | h¹¹=1, h²¹=101 | −200 | 1,0,1,204,1,0,1 |
| Quartic K3 in CP³ | 2 / 4 | h¹¹=20, h²⁰=1 | 24 | 1,0,22,0,1 |
| Smooth plane cubic | 1 / 2 | h¹⁰=1, h¹¹=1 | 0 | 1,2,1 |

References checked for this release:

- Hori et al., *Mirror Symmetry*, §3.6 and §6.5, [Clay Mathematics Monographs](https://people.maths.ox.ac.uk/cmi/library/monographs/cmim01c.pdf): quintic Hodge data and Euler characteristic.
- Daniel Huybrechts, *Lectures on K3 Surfaces*, Chapter 1, [author’s text](https://www.math.uni-bonn.de/people/huybrech/K3Global.pdf): K3 topology and quartic examples.
- [Seminar on Mixed Hodge Structures](https://www.math.columbia.edu/~plei/docs/notes/HT.pdf): genus-one complex tori and elliptic curves.

## Data and limits

Atlas records use the independent local-storage key `triscore-manifold-atlas-v1`, maximum 60 snapshots, 100 characters per title and 4,000 per note. The library schema is `triscore-manifold-atlas/v1`. Saves validate and commit before updating the displayed shelf. Stale-window saves detect a changed stored value and request reload. This local-storage check is not a transactional cross-process database.

Unreadable atlas data is preserved and blocks writes; the UI can export its raw text for recovery. Quota failures report an error without claiming a save. Imports are bounded to 400,000 bytes in the file picker / 400,000 characters in the core parser. Duplicate IDs are skipped, not overwritten. Derived metadata from imports is ignored and recalculated from validated recipes.

Views, notes, JSON and PNG are **unencrypted**. They never read the Tris vault. Tris continuity retains its existing separate encrypted implementation. Use atlas export for cross-device backup. Browser and native profiles are separate; unrelated executable branches do not migrate automatically.

## Implementation

`src/atlas-core.js` holds deterministic geometry and validation; `atlas-ui.js` connects the canvas and workspace; `atlas-panel.html` and `atlas-style.css` contain scoped presentation. `scripts/build.cjs` rebuilds the legacy workbench then adds the atlas and recomputes the CSP hashes. `BUILD-MANIFEST.json` verifies script preservation and the final HTML digest. No runtime CDN, framework, remote API, or network service is needed by the module.

Tests: `node --test tests/atlas.test.cjs` and `node tests/atlas-browser.cjs`. Browser tests require Playwright and Microsoft Edge. Native smoke stages `atlas` and `atlas-reopen` use a caller-supplied isolated profile. Existing create/reopen/import stages test encrypted Tris continuity.
