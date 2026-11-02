# Cosmic Origins: models, units and interpretation

TRIScore 4.3 adds molecular field tools to three educational models. They share a seeded,
reproducible simulation engine. These views illustrate mathematical behavior;
they are not precision early-universe calculations or molecular reconstructions
of the origin of life.

## Big Bang: homogeneous expansion

The scale factor follows a spatially flat FLRW expansion history containing
radiation, pressureless matter and a cosmological constant:

    E(a)^2 = Ωr/a^4 + Ωm/a^3 + ΩΛ
    E(a) = H(a)/H0
    d(H0 t)/d(log a) = 1/E(a)

The two user-controlled density inputs are nonnegative **weights**. A fixed
radiation weight of 0.00009 is added, and all three weights are divided by their
sum. Consequently the resulting Ωr + Ωm + ΩΛ = 1. The defaults approximate a
matter / dark-energy mixture; this is a chosen illustration, not a fitted data
product. Changing either weight also changes the normalized radiation fraction.

The program integrates dimensionless cosmic age on a 4,096-interval logarithmic
scale-factor table and inverts that table for playback. Scale factor ranges from
10^-15 to 1.5. The finite lower bound excludes the singularity; this model does
not calculate the particle-physics processes of the very earliest universe.
The radiation-era approximation supplies the small initial age offset. Piecewise
linear table inversion introduces a small numerical interpolation error.

**The timeline is logarithmic in dimensionless cosmic age, not evenly spaced
physical seconds.** Its duration control is playback duration in real seconds.
The diagram's camera and visual remapping of scale are presentation choices.

Readouts:

- `a`: scale factor relative to an arbitrary reference epoch at a = 1.
- `hubble`: H/H0; positive for the expanding branch.
- `density`: total density divided by the critical density at that reference.
- `temperature`: T/Tref = the chosen temperature multiplier divided by a.
- `age`: H0 t, with the finite-start approximation described above.
- Component fractions: the relative contributions to E(a)^2 at this a.
- `ageSeconds`: a background-age proxy converting H0 t using fixed
  H0 = 67.4 km s^-1 Mpc^-1. This is not the displayed playback clock.
- `tempKelvin`: 2.725 times the chosen temperature multiplier divided by a.
- `redshift`: 1/a − 1. Negative values represent the illustrated future a > 1.

Six era buttons seek to the exact integrated-table progress of chosen scale
factors: hot plasma (10^-15), primordial nuclei (2.7×10^-9), atoms / first light
(0.00091), dark ages (0.0012), first stars (0.045), and galaxies / cosmic web
(0.14). These markers are approximate conceptual overlays. Changing the density
mixture changes their integrated age without solving the underlying particle or
structure physics. The high-temperature extension keeps radiation degrees of
freedom fixed and omits particle thresholds and entropy transfer. Early-time
age and temperature conversions are rough proxies, not precision predictions.

The tracers occupy a homogeneous cube in comoving coordinates. A growing
separation of tracers represents expansion of space; there is no physical
explosion centre. Tracers do not undergo N-body gravity, nuclear reactions,
recombination or star formation. Epoch names are illustrative labels, not a
computed thermal or ionization history. Temperature uses an adiabatic radiation
scaling and omits changing relativistic degrees of freedom. Inflation, quantum
gravity, neutrino transitions and perturbation spectra are not calculated.
Visual era progression and luminous structure overlays are presentation choices.
They do not turn the background into a nuclear or N-body solver. NASA's
[universe overview](https://science.nasa.gov/universe/overview/) and
[first-stars timeline](https://science.nasa.gov/asset/webb/first-stars-timeline-of-the-universe/)
describe the conceptual sequence used for these markers.

The homogeneous expansion equations and dimensionless time integration are
consistent with the methods described by E. L. Wright in
[A Cosmology Calculator for the World Wide Web](https://arxiv.org/abs/astro-ph/0609593)
(2006). This implementation has a deliberately smaller educational scope.

## Big Bounce: a finite minimum

The bounce view uses a deliberately analytic, nonsingular scale-factor curve:

    p ∈ [0,1], τ = 2p − 1
    a(p) = amin + (1 − amin) [1 + cos(2πp)] / 2
    Htoy = (1/a) da/dτ

It starts at a = 1, contracts to the user's amin at p = 0.5, and re-expands to
a = 1. Since amin ≥ 0.02, scale factor, illustrative density and temperature stay
finite. Density uses the same matter/radiation/dark-energy scaling as the
expansion view. This does **not** make the bounce a solution of that ordinary
Friedmann equation: the curve is prescribed independently. The negative and
positive Htoy readings show contraction and expansion in the dimensionless τ
clock. The full signed clock is reported in `age`; its units differ from the
Big Bang model's age. A reset or repeat of this curve is a display cycle, not
evidence that the actual universe is cyclic.

The conceptual possibility of a quantum cosmological bounce is discussed in
Ashtekar, Pawlowski and Singh,
[Quantum Nature of the Big Bang](https://arxiv.org/abs/gr-qc/0602086) (2006).
Their specific homogeneous scalar-field model and quantum dynamics are **not**
implemented here. The program illustrates a bounce hypothesis and makes no
claim that it has been observed.

## Primordial soup: abstract autocatalytic chemistry

The soup is an **abstract prebiotic-pattern toy**, using a Gray–Scott-style
reaction–diffusion model. Its labels may be read as a precursor U and an
autocatalyst V. The schematic processes are:

    U + 2V → 3V       autocatalytic conversion
    V → inert waste  removal
    external feed → U; outflow removes U and V

The implemented equations are:

    ∂U/∂t = Du ∇²U + Θ [−k U V² + F(1 − U)]
    ∂V/∂t = Dv ∇²V + Θ [ k U V² − (F + K)V]

Here U and V are dimensionless concentrations; F is feed, K is degradation,
k = 0.65 + 0.7 × energy, and Θ = (0.6 + 0.4 × temperature) ×
(1 + 0.25 × pulse-heat + 0.08 × continuous-electric-field). Temperature and energy
are qualitative controls: they are not kelvin, Arrhenius activation energies or
a chemical energy conservation model. Diffusion coefficients are
Du = 0.16(0.35 + 0.9 × mixing) and Dv = Du/2. The open feed / degradation system
does not conserve the sum of U and V.

Three presets choose different feed/degradation rates: dividing spots uses
F = 0.038, K = 0.061; filament garden uses F = 0.028, K = 0.057; coral garden
uses F = 0.054, K = 0.063. Their names
describe spatial patterns. A splitting spot is not a living cell or evidence of
molecular replication. These names remain illustrative when other parameters
are changed.

Numerics use a square, periodic lattice and a four-neighbor finite-difference
Laplacian. Concentrations start at the feed equilibrium U = 1, V = 0, perturbed
by nine seeded patches and small seeded concentration variations. Two explicit
Euler iterations of dimensionless dt = 0.45 run per fixed 1/60 playback-second
tick. Values are bounded to [0,1] to keep all allowed interactive conditions
stable. That bounding is a numerical safeguard, not a physical saturation law.
Seeding / painting a catalyst patch intentionally adds or removes material.
The periodic boundary wraps the displayed square rather than modeling a
physical container wall.

The underlying abstract pattern model is described by John E. Pearson,
[Complex Patterns in a Simple System](https://arxiv.org/abs/patt-sol/9304003)
(1993). This app adds qualitative controls and visualization choices.

No particular molecules, amino acids, RNA, membranes, hydrothermal vent
chemistry, ligation, hydrolysis, sequence information, evolution or abiogenesis
are simulated. It is prebiotic **chemical** soup as a visual exploration of
autocatalysis and transport; it is not the early universe's quark–gluon plasma.

## Molecular bead layer: electrocute, stir and magnetize

The concentration field now carries a separately simulated, coarse-grained
layer of 240 seeded beads by default. They are abstract precursor, ion and
catalyst representatives, not identified real molecules. Each bead stores
periodic 2D position, velocity, charge, dipole angle, magnetic susceptibility and
species. Precursor beads are neutral and nonmagnetic; ion beads have positive
or negative unit charge and no intrinsic dipole susceptibility; catalyst beads
are neutral and assigned a susceptible toy dipole. Not every molecule is
ferromagnetic, and this layer does not imply that it is.

Three tools change actual numerical state:

- **Electrocute:** a localized Gaussian pulse gives charged beads opposite
  electric velocity kicks, increases V and consumes some U near the selected
  point, and adds a bounded activation/heat proxy. The activation decays with
  a 0.45 inverse-playback-second rate. A continuous electric field accelerates
  beads by qE in the selected in-plane direction. The conversion from field
  controls to force is dimensionless; there are no volt or joule claims.
- **Stir:** a local vortex kicks bead velocities and persists for 2.5 playback
  seconds. A continuous signed vortex is also available. The same prescribed
  velocity field transports U and V through periodic semi-Lagrangian bilinear
  advection before each pair of reaction/diffusion iterations. This scheme is
  bounded and visibly mixes the soup, but is not exactly mass-conserving and
  does not solve Navier–Stokes fluid dynamics.
- **Magnetize:** an out-of-plane magnetic proxy deflects moving charges through
  the Lorentz term q(v×B). It is integrated as an exact velocity rotation, so
  that isolated term preserves speed. Independently, susceptible catalyst
  dipoles relax toward the chosen in-plane field direction and experience a
  toy attraction toward the localized field-strength maximum. Reversing
  polarity reverses charge deflection and dipole alignment; the attraction of
  an aligned susceptible bead toward stronger field remains attractive.

The in-plane dipole bias and out-of-plane Lorentz field are a pedagogical
combination, not a Maxwell-consistent 3D electromagnetic solution. The direction
and polarity controls affect both components. The dipole response is an assigned
coarse-grained susceptibility, not a calculation of molecular electronic states,
spin, chemical bonds, polarization or real material magnetization. Dipole
gradient forces, electric work, imposed fluid forcing, and solvent drag can
change kinetic energy; that does not contradict the no-work property of the
isolated magnetic Lorentz term. The basic charge-force relationship is described
in [OpenStax's magnetic force treatment](https://openstax.org/books/college-physics-2e/pages/22-4-magnetic-field-strength-force-on-a-moving-charge-in-a-magnetic-field).

Velocities receive exponential solvent drag of rate 0.85 per playback second,
and are bounded to ±2 patch widths per playback second. Positions wrap at the
square's edge. All bead updates share the deterministic 1/60 playback-second
tick. No ongoing random force is used, and there are no all-pairs interactions.
The RD field and bead layer couple through imposed tools and flow; individual
beads do not consume concentration or undergo bond chemistry. Chemical
activation introduced by an electric pulse is an explicit toy intervention,
not a prediction of electrical synthesis yields.

`inspect` reports average bead kinetic energy, signed projected charge
separation, mean susceptible-dipole alignment to the current selected direction,
activation heat, and zap/stir/magnet event counts. These are model measurements;
all are dimensionless. The selection direction can differ from a still-decaying
pulse direction if controls are changed after a pulse.

## Reproducibility and exports

All initial conditions use a deterministic integer seed. Soup updates accumulate
fixed timesteps so equivalent elapsed playback split across different frame
sizes yields the same fields. Rendering and camera motion do not alter fields.
Cosmic seeks recompute the mathematical state at the requested timeline point;
soup has history and must be reset or restored from a snapshot.

`TRIScoreOriginsCore.snapshot(sim)` stores canonical configuration, clock, solver
iteration count and fractional timestep accumulator. Soup snapshots include
both complete Float32 concentration fields, every bead field, continuous field
settings, active pulses, activation heat and interaction counters, encoded with
little-endian Float32 base64 where appropriate. The default 100 × 100 grid and
240 beads produce a JSON snapshot of approximately 118 KB.
Restores validate dimensions, numerical bounds, schema and clocks before
returning a new simulation. Tracers regenerate exactly from the seed.

Version 4.3 writes `triscore-origins-state/v2`. Original
`triscore-origins-state/v1` snapshots remain readable: soup U/V fields, clocks and
solver accumulator are retained exactly, and the new bead layer is seeded with
zero imposed fields. With zero forcing, future concentration evolution remains
byte-identical to the 4.2 engine. Original cosmic snapshots retain their playback
clock and recipe; the Big Bang scene now uses the expanded timeline, so the same
playback percentage refers to an earlier epoch than in 4.2.

API exports: `defaults`, `validateConfig`, `random`, `create`, `step`, `inspect`,
`cosmicState`, `seek`, `inject`, `snapshot`, `restore`, `soupPresets`, `bounds`,
`eras`, `eraProgress`, `interact`, `setForcing`, `forcingDefaults`, `lorentzRotate`,
`LEGACY_SCHEMA` and `SCHEMA`. Browser global: `TRIScoreOriginsCore`; Node CommonJS:
`module.exports`.

`step(sim, dt)` accepts 0–10 real seconds and multiplies by configuration speed.
The UI normally supplies much smaller frame increments. Cosmic playback clamps
at its duration; soup can continue after its progress indicator reaches one.
`seek(sim, p)` accepts only cosmic modes. `inject(sim, x, y, radius)` accepts
normalized coordinates and periodic soup only. Every field and clock is
dimensionless unless explicitly described as playback seconds above.

Run `node --test tests/origins.test.cjs` for independent checks of expansion
invariants, Friedmann integration, bounce symmetry and finite minimum,
seed reproducibility, fixed-step independence, periodic diffusion, equilibrium,
pattern evolution, exact snapshot continuation and malformed-input rejection.
