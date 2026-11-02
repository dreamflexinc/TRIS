# Topology architecture and measurement guide

## Data path

```text
Existing TRIScore modules (inspect / accepted snapshot)
                 ↓ read-only numeric/status adapters, up to 5 Hz
       Typed graph + bounded observation history
                 ↓
  3D canvas / node inspector / explicit JSON or PNG export

Independent Lorenz reference ──→ trajectory + tangent growth
Fermat quintic sampler ────────→ projected slice + illustrative loops
```

The added code does not change laboratory equations, accepted states, or navigation policies. Opening another workspace still pauses the previous lab. The floating monitor stays visible in the active lab so it can observe evolution without overriding that policy.

The renderer uses Canvas 2D for perspective projection of 3D coordinates, matching the lightweight, self-contained approach of the recovered workbench. It needs no WebGL library, CDN, remote API, or worker. Orbit, zoom, picking, keyboard controls, labels, and a text inspector share the scene state.

## Graph provenance

| Node or edge | Source and interpretation |
| --- | --- |
| Module nodes | Registered `.page` workspaces, including idle or uninstrumented modules. These are not native process IDs. |
| Numerical lab state | Existing `inspect()` APIs; selected finite numeric fields only. Failed providers are marked unavailable. |
| Resonance subengines | Chaos, resonator, synchrony, wave, and matter; accepted configuration plus current state. |
| Solid signal links | Accepted Resonance routes and committed port values. Width reflects absolute held signal value; pulses require a running enabled route. |
| Kaos couplings | Configured strings/Lorenz inputs to the wave potential, drawn as dashed links. These are not completed-transfer measurements. |
| Declared transfers | Existing reviewed science staging/exchange paths. A declared link alone does not imply that a transfer occurred. |
| Event links | Navigation, control requests, theme/graph events, and Tris state-change notifications observed while the monitor runs. Control requests do not assert success. |
| Tris / Sentinel | Mounted/sealed status only. |
| Private modules | Presence only. No text, journal, memory, or identity inspection. |

Metadata is sampled at most every 200 ms while the full view or dock is visible and unpaused. History retains 80 events; pulses last about 2.5 seconds. This is sampled observation, not an exhaustive trace of every integration step or browser interaction. Native processes and uninstrumented internal function calls are outside its scope.

Graph statistics discard direction, duplicate endpoint pairs, self-links, and missing endpoints. Components and cycle rank `E − V + C` describe that simple filtered graph. The visible edge count still includes separately typed and directed links. Neither count computes the topology of the Calabi–Yau manifold.

## Attractor and sensitivity

The independent reference integrates

```text
dx/dt = 10(y − x)
dy/dt = x(28 − z) − y
dz/dt = xy − (8/3)z
```

using fourth-order Runge–Kutta at `dt = 0.005`. A tangent vector evolves under the analytic Jacobian in the same RK4 step. Its norm is logged and it is renormalized after each step. The displayed finite-time rate is logarithmic growth divided by elapsed model time after a 10-unit burn-in. A 6,000-step warm start supplies an initial 30-unit trajectory. At most 2,000 points are retained.

This estimate is attached to **Reference Lorenz**, not the whole application. Nexus supplies its accepted standard-map or logistic-map estimate per iterate; Frontier supplies its first QR spectrum rate per model time when available. Sensitivity colors classify their signs without comparing magnitudes across different units or models. Missing estimates remain unclassified.

**Live Resonance Lorenz** uses actual accepted `snapshot().chaos` coordinates and ticks, sampled up to five times a second, retaining 1,000 points. The path clears on a backwards tick or unavailable/draft state. It does not infer an exponent from position samples. Dock the monitor and run Resonance to collect the trajectory; a short history uses a spherical node layout until enough points exist.

Module placement along either trajectory is illustrative. Halo size, decorative pulse speed, and camera motion are not physical measurements. Pausing stops observation and reference integration without pausing a running lab. Hiding the browser pauses observation; returning requires explicit resume.

## Calabi–Yau slice and string loops

The Fermat quintic in complex projective four-space is

```text
Z₀⁵ + Z₁⁵ + Z₂⁵ + Z₃⁵ + Z₄⁵ = 0  in CP⁴.
```

It is a smooth Calabi–Yau threefold (three complex, six real dimensions). This display fixes `Z₀ = 1` and `Z₃ = Z₄ = 0`, then samples the affine curve

```text
1 + z₁⁵ + z₂⁵ = 0.
```

For each sampled `z₁`, the code calculates all five complex roots for `z₂`. The 3,900 mesh samples have four real coordinates. The display projection is proportional to

```text
(Re z₁, Im z₁, cos(φ) Re z₂ + sin(φ) Im z₂).
```

The slider changes `φ`, then the camera projects these three coordinates onto the screen. Long links across root-chart branch cuts are omitted. Visible gaps are sampling/chart artifacts, not physical holes or boundaries of the entire manifold. This bounded affine slice is not the entire six-dimensional Calabi–Yau or a complete compact surface reconstruction.

Each optional loop has parameter `s ∈ [0, 2π]` and radial displacement

```text
u(s,t) = 0.09 cos(3s) cos(3 × 0.7 × t),
u_tt = 0.7² u_ss,
z₁(s,t) = (0.63 + u(s,t)) exp(is).
```

The roots embed the loop into each sheet. The displacement solves the periodic one-dimensional wave equation; the embedding is illustrative. No Ricci-flat metric, string action, Nambu–Goto evolution, compactification dynamics, or string-theory prediction is computed. Equation residual and continuity tests validate this slice and wave, not a physical string model.

Mathematical context: [MIT's lecture notes on Calabi–Yau hypersurfaces](https://ocw.mit.edu/courses/18-969-topics-in-geometry-mirror-symmetry-spring-2009/11f2fffa337f9a6ec301c32b1ddb3d98_MIT18_969s09_lec06.pdf) and [Ruan's work on the Fermat quintic](https://arxiv.org/abs/math/9904012).

## Atomic lens

Positions come from Matter 3D's accepted checkpoint. Density and particle count determine box length. Positions are wrapped for display; candidate-neighbor distances use periodic minimum images. The global cutoff selects possible neighbors, and the dimer model's explicit harmonic partners use a distinct edge type. These are not inferred chemical bonds or species-specific pair-force measurements. Wrapped display lines can cross the box even when minimum-image distance is short.

At most 128 particles and 1,200 edges are displayed. The interface reports original particle count, displayed count, and candidate edge count among displayed particles. Truncation is explicit. Snapshot reads do not advance the lab.

## Privacy, export, and integration

The telemetry adapter has no vault handle and never calls Tris `readState` or `consoleIdentity`, DreamFlex inspection, or Exchange inspection. It does not read editable text areas, passphrases, journals, or exported private content. Tris schema, grants, encryption, audit, reset/delete controls, and native boot adapter are unchanged from 3.0.

Recent observations live only in memory. Sentinel sealing and page hiding clear them. Explicit JSON exports use `triscore.topology.export.v1`, including timestamps, numeric observations, edge types, and reference/geometry scope. PNG captures the canvas. These files are unencrypted; neither is a Tris backup. The network-blocking Content Security Policy remains in place.

The public `TRIScoreTopologyLab` API offers `open()`, `inspect()`, and a detached JSON-safe `snapshot()` for local integration. `TRIScoreTopologyTelemetry.Telemetry` is the adapter entry point. To add a provider, use a stable module ID, read accepted numeric/status values, include units and provenance, fail to unavailable, and add privacy/behavior tests. Memory access is unnecessary to make a node appear.

A future native process bridge needs its own explicit host interface, permissions, interaction definitions, and bounded transport. No native monitoring service is installed by this release.
