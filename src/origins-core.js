(function (root) {
  'use strict';
  const B=typeof module!=='undefined'&&module.exports?require('./brand-compat.js'):root.TRIScoreBrandCompat;
  const SCHEMA = 'triscore-origins-state/v2', LEGACY_SCHEMA = 'triscore-origins-state/v1';
  const MODES = Object.freeze(['bang', 'bounce', 'soup']);
  const FIXED_DT = 1 / 60;
  const RADIATION_WEIGHT = 0.00009;
  const BANG_MIN = 1e-15, BANG_MAX = 1.5;
  const H0_PER_SECOND = 67.4 / 3.0856775814913673e19;
  const BEAD_FIELDS = ['x', 'y', 'vx', 'vy', 'charge', 'dipole', 'susceptibility', 'kind'];
  const bounds = Object.freeze({
    seed: [0, 4294967295], speed: [0.1, 8], duration: [10, 240],
    particles: [100, 4000], omegaMatter: [0, 1], omegaLambda: [0, 1],
    bounceMin: [0.02, 0.6], temperature: [0.2, 3], energy: [0, 1],
    mixing: [0, 1], feed: [0.005, 0.09], kill: [0.025, 0.08], grid: [40, 160], beadCount: [60, 600]
  });
  const soupPresets = Object.freeze([
    Object.freeze({ id: 'spots', name: 'Dividing spots', feed: 0.038, kill: 0.061 }),
    Object.freeze({ id: 'filaments', name: 'Filament garden', feed: 0.028, kill: 0.057 }),
    Object.freeze({ id: 'coral', name: 'Coral garden', feed: 0.054, kill: 0.063 })
  ]);

  function defaults(mode = 'bang') {
    if (!MODES.includes(mode)) throw Error('Unknown Origins simulation mode.');
    return { mode, seed: 42, speed: 1, duration: 40, particles: 900,
      omegaMatter: 0.315, omegaLambda: 0.685, bounceMin: 0.12,
      temperature: 1, energy: 0.55, mixing: 0.5, feed: 0.038, kill: 0.061, grid: 100, beadCount: 240 };
  }

  function validateConfig(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('Origins settings must be an object.');
    const c = defaults(raw.mode === undefined ? 'bang' : raw.mode);
    for (const key of Object.keys(c)) if (Object.prototype.hasOwnProperty.call(raw, key)) c[key] = raw[key];
    for (const [key, [lo, hi]] of Object.entries(bounds)) {
      if (typeof c[key] !== 'number' || !Number.isFinite(c[key]) || c[key] < lo || c[key] > hi)
        throw Error('Out-of-range Origins setting: ' + key);
    }
    for (const key of ['seed', 'particles', 'grid', 'beadCount']) if (!Number.isInteger(c[key]))
      throw Error('Origins setting must be an integer: ' + key);
    return c;
  }

  function random(seed) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) throw Error('Invalid random seed.');
    let n = seed >>> 0;
    return function () {
      n += 0x6D2B79F5;
      let t = n;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  function weights(c) {
    const total = c.omegaMatter + c.omegaLambda + RADIATION_WEIGHT;
    return { m: c.omegaMatter / total, l: c.omegaLambda / total, r: RADIATION_WEIGHT / total };
  }
  function energyAt(a, w) { return w.r / (a ** 4) + w.m / (a ** 3) + w.l; }

  // Integrate d(H0 t)/d(log a) = 1/E(a). Playback is logarithmic in
  // dimensionless cosmic age; it deliberately compresses the early epochs.
  const tables = new Map();
  function expansionTable(c) {
    const key = c.omegaMatter + ',' + c.omegaLambda;
    if (tables.has(key)) return tables.get(key);
    const w = weights(c), n = 4096, aa = new Float64Array(n + 1), tt = new Float64Array(n + 1);
    const x0 = Math.log(BANG_MIN), dx = Math.log(BANG_MAX / BANG_MIN) / n;
    aa[0] = BANG_MIN;
    // The radiation-era approximation supplies a positive lower integration
    // bound. The actual singularity is outside this finite model's range.
    tt[0] = BANG_MIN * BANG_MIN / (2 * Math.sqrt(w.r));
    let previous = 1 / Math.sqrt(energyAt(aa[0], w));
    for (let i = 1; i <= n; i++) {
      aa[i] = Math.exp(x0 + dx * i);
      const next = 1 / Math.sqrt(energyAt(aa[i], w));
      tt[i] = tt[i - 1] + dx * (previous + next) / 2;
      previous = next;
    }
    const table = { aa, tt, w };
    if (tables.size >= 32) tables.delete(tables.keys().next().value);
    tables.set(key, table);
    return table;
  }

  function cosmicState(raw, progress) {
    const c = validateConfig(raw);
    if (c.mode === 'soup') throw Error('Soup uses concentration fields, not a cosmological scale factor.');
    if (typeof progress !== 'number' || !Number.isFinite(progress) || progress < 0 || progress > 1)
      throw Error('Timeline progress must be between zero and one.');
    let a, hubble, age, phase;
    const w = weights(c);
    if (c.mode === 'bang') {
      const table = expansionTable(c), { aa, tt } = table;
      age = Math.exp(Math.log(tt[0]) + progress * Math.log(tt[tt.length - 1] / tt[0]));
      let lo = 0, hi = tt.length - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >>> 1; if (tt[mid] < age) lo = mid; else hi = mid; }
      const f = clamp((age - tt[lo]) / (tt[hi] - tt[lo]), 0, 1);
      a = progress === 0 ? BANG_MIN : progress === 1 ? BANG_MAX : aa[lo] + f * (aa[hi] - aa[lo]);
      hubble = Math.sqrt(energyAt(a, w));
      const radiation = w.r / a ** 4, matter = w.m / a ** 3;
      phase = radiation > matter && radiation > w.l ? 'Radiation-dominated plasma'
        : a < 0.001 ? 'Cooling plasma' : a < 0.03 ? 'Neutral gas / dark ages'
        : a < 0.3 ? 'Structure era' : w.l > matter ? 'Dark-energy era' : 'Matter-dominated expansion';
    } else {
      // Deliberately phenomenological and nonsingular. This analytic shape is
      // not a numerical solution of the loop-quantum-cosmology equations.
      const theta = 2 * Math.PI * progress;
      a = c.bounceMin + (1 - c.bounceMin) * (1 + Math.cos(theta)) / 2;
      if (progress === 0.5) a = c.bounceMin;
      const da = -(1 - c.bounceMin) * Math.PI * Math.sin(theta);
      hubble = Math.abs(da) < 1e-12 ? 0 : da / (2 * a);
      age = 2 * progress - 1;
      phase = Math.abs(progress - 0.5) < 0.025 ? 'Finite-density bounce'
        : progress < 0.5 ? 'Contraction' : 'Re-expansion';
    }
    const density = energyAt(a, w);
    const era = c.mode === 'bang' ? eraAt(c, a) : { id: 'bounce', name: phase,
      explanation: 'A prescribed nonsingular bounce, not a physical age reconstruction.' };
    return { a, hubble, density, temperature: c.temperature / a, phase, progress, age,
      matterFraction: (w.m / a ** 3) / density, radiationFraction: (w.r / a ** 4) / density,
      lambdaFraction: w.l / density, cycle: 0, ageSeconds: c.mode === 'bang' ? age / H0_PER_SECOND : null,
      tempKelvin: 2.725 * c.temperature / a, redshift: 1 / a - 1, era, eraId: era.id };
  }

  const eraSpecs = [
    { id: 'plasma', name: 'Hot particle plasma', aMin: BANG_MIN,
      explanation: 'A schematic hot particle era. Homogeneous expansion is computed; particle interactions, inflation and quantum gravity are not.' },
    { id: 'nuclei', name: 'Primordial nuclei', aMin: 2.7e-9,
      explanation: 'An approximate nucleosynthesis marker. Hydrogen/helium nuclei are conceptual tracers; nuclear reaction yields are not solved.' },
    { id: 'atoms', name: 'Atoms & first light', aMin: 0.00091,
      explanation: 'An approximate recombination marker. Neutral atoms and the CMB are conceptual overlays, not a calculated ionization history.' },
    { id: 'darkages', name: 'The dark ages', aMin: 0.0012,
      explanation: 'A largely neutral-gas era before luminous stars. Cooling chemistry and gravitational collapse are not calculated.' },
    { id: 'firststars', name: 'First stars', aMin: 0.045,
      explanation: 'An illustrative cosmic-dawn marker; the first-star time is uncertain. Star formation and reionization are not simulated.' },
    { id: 'cosmicweb', name: 'Galaxies & cosmic web', aMin: 0.14,
      explanation: 'A conceptual structure-era overlay. The simulation remains a homogeneous FLRW background, not an N-body cosmic-web calculation.' }
  ].map(Object.freeze);

  function eraProgress(raw, id) {
    const c = validateConfig(raw), e = eraSpecs.find(item => item.id === id);
    if (!e || c.mode !== 'bang') throw Error('Choose a known Big Bang era.');
    const { aa, tt } = expansionTable(c), a = e.aMin;
    if (a <= BANG_MIN) return 0;
    let lo = 0, hi = aa.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >>> 1; if (aa[mid] < a) lo = mid; else hi = mid; }
    const f = (a - aa[lo]) / (aa[hi] - aa[lo]), age = tt[lo] + f * (tt[hi] - tt[lo]);
    return clamp(Math.log(age / tt[0]) / Math.log(tt[tt.length - 1] / tt[0]), 0, 1);
  }

  function eraAt(c, a) {
    let e = eraSpecs[0];
    for (const item of eraSpecs) if (a >= item.aMin * (1 - 1e-10)) e = item;
    return { ...e, progress: eraProgress(c, e.id) };
  }

  const eras = Object.freeze(eraSpecs.map(e => Object.freeze({ ...e, progress: eraProgress(defaults(), e.id) })));

  function particlesFor(c) {
    const rng = random(c.seed), p = new Float32Array(c.particles * 3);
    // A cube of comoving tracer points fills space. There is no explosion
    // centre in this FLRW model; camera framing is a display choice.
    for (let i = 0; i < p.length; i++) p[i] = (rng() * 2 - 1) * 1.25;
    return p;
  }

  function forcingDefaults() {
    return { electric: 0, stir: 0, magnetic: 0, fieldAngle: 0, polarity: 1, centerX: 0.5, centerY: 0.5 };
  }

  function forcingValue(raw, previous = forcingDefaults()) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('Field controls must be an object.');
    const f = { ...previous };
    const fb = { electric: [0, 1], stir: [-1, 1], magnetic: [0, 1], fieldAngle: [0, 2 * Math.PI], centerX: [0, 1], centerY: [0, 1] };
    for (const key of Object.keys(f)) if (Object.prototype.hasOwnProperty.call(raw, key)) f[key] = raw[key];
    for (const [key, [lo, hi]] of Object.entries(fb)) if (!Number.isFinite(f[key]) || f[key] < lo || f[key] > hi)
      throw Error('Invalid field control: ' + key);
    if (f.polarity !== 1 && f.polarity !== -1) throw Error('Field polarity must be +1 or −1.');
    return f;
  }

  function beadsFor(c) {
    const count = c.beadCount, rng = random((c.seed ^ 0x5A17B3C9) >>> 0), beads = { count };
    for (const key of BEAD_FIELDS) beads[key] = key === 'kind' ? new Uint8Array(count) : new Float32Array(count);
    for (let i = 0; i < count; i++) {
      beads.x[i] = 0.04 + 0.92 * rng(); beads.y[i] = 0.04 + 0.92 * rng();
      beads.vx[i] = (rng() - 0.5) * 0.035; beads.vy[i] = (rng() - 0.5) * 0.035;
      beads.kind[i] = i % 3; beads.charge[i] = i % 3 === 1 ? (i % 2 ? 1 : -1) : 0;
      beads.susceptibility[i] = i % 3 === 2 ? 0.8 : 0;
      beads.dipole[i] = rng() * 2 * Math.PI;
    }
    return beads;
  }

  const wrap = v => (v % 1 + 1) % 1;
  const periodicDelta = v => v - Math.round(v);
  function vortex(x, y, centerX, centerY, strength) {
    const dx = periodicDelta(x - centerX), dy = periodicDelta(y - centerY);
    const scale = 4 * strength * Math.exp(-(dx * dx + dy * dy) / 0.12);
    return [-dy * scale, dx * scale];
  }

  // Exact rotation for q(v × B): this isolated operation changes direction,
  // never speed. Dipole forces and solvent drag are separate operations.
  function lorentzRotate(vx, vy, charge, magnetic, dt) {
    if (![vx, vy, charge, magnetic, dt].every(Number.isFinite) || dt < 0 || dt > 10)
      throw Error('Invalid Lorentz rotation.');
    const angle = -charge * magnetic * dt, cs = Math.cos(angle), sn = Math.sin(angle);
    return [vx * cs - vy * sn, vx * sn + vy * cs];
  }

  function setForcing(sim, raw) {
    if (!sim || sim.config.mode !== 'soup') throw Error('Laboratory fields operate in primordial soup.');
    sim.forcing = forcingValue(raw, sim.forcing); return sim;
  }

  function localActivation(sim, x, y, strength) {
    const n = sim.size, radius = 0.14;
    for (let py = 0; py < n; py++) for (let px = 0; px < n; px++) {
      const dx = periodicDelta((px + 0.5) / n - x), dy = periodicDelta((py + 0.5) / n - y), r2 = dx * dx + dy * dy;
      if (r2 > radius * radius * 4) continue;
      const w = Math.exp(-r2 / (radius * radius)), i = py * n + px;
      sim.V[i] = clamp(sim.V[i] + 0.24 * strength * w, 0, 1);
      sim.U[i] = clamp(sim.U[i] - 0.12 * strength * w, 0, 1);
    }
  }

  function interact(sim, raw) {
    if (!sim || sim.config.mode !== 'soup') throw Error('Molecular tools operate in primordial soup.');
    if (!raw || !['zap', 'stir', 'magnet'].includes(raw.type)) throw Error('Choose zap, stir or magnet.');
    const { type } = raw, x = raw.x === undefined ? 0.5 : raw.x, y = raw.y === undefined ? 0.5 : raw.y;
    const strength = raw.strength === undefined ? 0.7 : raw.strength;
    if (![x, y, strength].every(Number.isFinite) || x < 0 || x > 1 || y < 0 || y > 1 || strength < 0 || strength > 1)
      throw Error('Invalid tool location or strength.');
    const b = sim.beads, f = sim.forcing, angle = f.fieldAngle, sign = f.polarity;
    const dirX = Math.cos(angle) * sign, dirY = Math.sin(angle) * sign;
    sim[type + 'Count']++;
    for (let i = 0; i < b.count; i++) {
      const dx = periodicDelta(b.x[i] - x), dy = periodicDelta(b.y[i] - y), weight = Math.exp(-(dx * dx + dy * dy) / 0.055);
      if (type === 'zap') {
        const kick = 0.7 * strength * weight * b.charge[i];
        b.vx[i] = clamp(b.vx[i] + kick * dirX, -2, 2); b.vy[i] = clamp(b.vy[i] + kick * dirY, -2, 2);
      } else if (type === 'stir') {
        const v = vortex(b.x[i], b.y[i], x, y, strength * sign);
        b.vx[i] = clamp(b.vx[i] + v[0] * 0.65, -2, 2); b.vy[i] = clamp(b.vy[i] + v[1] * 0.65, -2, 2);
      } else {
        const target = angle + (sign < 0 ? Math.PI : 0), torque = strength * b.susceptibility[i] * weight;
        b.dipole[i] = wrap((b.dipole[i] + torque * Math.sin(target - b.dipole[i])) / (2 * Math.PI)) * 2 * Math.PI;
        b.vx[i] = clamp(b.vx[i] - dx * torque * 0.7, -2, 2); b.vy[i] = clamp(b.vy[i] - dy * torque * 0.7, -2, 2);
        const rotated = lorentzRotate(b.vx[i], b.vy[i], b.charge[i], sign * strength * weight * 2, 0.2);
        b.vx[i] = rotated[0]; b.vy[i] = rotated[1];
      }
    }
    if (type === 'zap') { localActivation(sim, x, y, strength); sim.heat = clamp(sim.heat + strength * 0.7, 0, 3); }
    const total = type === 'zap' ? 0.8 : 2.5;
    sim.pulses.push({ type, x, y, strength, remaining: total, total, angle, polarity: sign });
    if (sim.pulses.length > 12) sim.pulses.shift();
    return sim;
  }

  function stirFields(sim) {
    const fields = [], f = sim.forcing;
    if (f.stir) fields.push({ x: f.centerX, y: f.centerY, strength: f.stir });
    for (const p of sim.pulses) if (p.type === 'stir' && p.remaining > 0)
      fields.push({ x: p.x, y: p.y, strength: p.strength * p.polarity * p.remaining / p.total });
    return fields;
  }

  function advectSoup(sim, fields) {
    if (!fields.length) return;
    const n = sim.size, { U, V, nextU, nextV } = sim;
    const sample = (field, x, y) => {
      const xx = wrap(x) * n - 0.5, yy = wrap(y) * n - 0.5;
      const x0 = Math.floor(xx), y0 = Math.floor(yy), fx = xx - x0, fy = yy - y0;
      const xa = (x0 + n) % n, xb = (x0 + 1 + n) % n, ya = (y0 + n) % n, yb = (y0 + 1 + n) % n;
      return (1 - fy) * ((1 - fx) * field[ya * n + xa] + fx * field[ya * n + xb])
        + fy * ((1 - fx) * field[yb * n + xa] + fx * field[yb * n + xb]);
    };
    for (let py = 0; py < n; py++) for (let px = 0; px < n; px++) {
      const x = (px + 0.5) / n, y = (py + 0.5) / n, i = py * n + px;
      let ux = 0, uy = 0;
      for (const f of fields) { const vel = vortex(x, y, f.x, f.y, f.strength); ux += vel[0]; uy += vel[1]; }
      nextU[i] = sample(U, x - ux * FIXED_DT, y - uy * FIXED_DT);
      nextV[i] = sample(V, x - ux * FIXED_DT, y - uy * FIXED_DT);
    }
    sim.U = nextU; sim.V = nextV; sim.nextU = U; sim.nextV = V;
  }

  function beadTick(sim, fields) {
    const b = sim.beads, f = sim.forcing, dt = FIXED_DT, damping = Math.exp(-0.85 * dt);
    const electricX = f.electric * f.polarity * Math.cos(f.fieldAngle), electricY = f.electric * f.polarity * Math.sin(f.fieldAngle);
    for (let i = 0; i < b.count; i++) {
      let vx = b.vx[i], vy = b.vy[i], targetVX = 0, targetVY = 0;
      for (const v of fields) { const flow = vortex(b.x[i], b.y[i], v.x, v.y, v.strength); targetVX += flow[0]; targetVY += flow[1]; }
      vx += b.charge[i] * electricX * 0.9 * dt; vy += b.charge[i] * electricY * 0.9 * dt;
      if (fields.length) { const relax = 1 - Math.exp(-3 * dt); vx += (targetVX - vx) * relax; vy += (targetVY - vy) * relax; }
      let magnetic = f.magnetic * f.polarity;
      const magneticFields = [];
      if (f.magnetic) magneticFields.push({ x: f.centerX, y: f.centerY, strength: f.magnetic, sign: f.polarity, angle: f.fieldAngle });
      for (const p of sim.pulses) if (p.type === 'magnet') {
        const dx = periodicDelta(b.x[i] - p.x), dy = periodicDelta(b.y[i] - p.y);
        const strength = p.strength * p.remaining / p.total;
        magnetic += p.polarity * strength * Math.exp(-(dx * dx + dy * dy) / 0.08);
        magneticFields.push({ x: p.x, y: p.y, strength, sign: p.polarity, angle: p.angle });
      }
      for (const m of magneticFields) if (b.susceptibility[i]) {
        const dx = periodicDelta(b.x[i] - m.x), dy = periodicDelta(b.y[i] - m.y), weight = Math.exp(-(dx * dx + dy * dy) / 0.08);
        const response = b.susceptibility[i] * m.strength * weight;
        const target = m.angle + (m.sign < 0 ? Math.PI : 0);
        b.dipole[i] = wrap((b.dipole[i] + 6 * response * Math.sin(target - b.dipole[i]) * dt) / (2 * Math.PI)) * 2 * Math.PI;
        vx -= dx * response * 2 * dt; vy -= dy * response * 2 * dt;
      }
      const rotated = lorentzRotate(vx, vy, b.charge[i], magnetic * 8, dt);
      b.vx[i] = clamp(rotated[0] * damping, -2, 2); b.vy[i] = clamp(rotated[1] * damping, -2, 2);
      b.x[i] = wrap(b.x[i] + b.vx[i] * dt); b.y[i] = wrap(b.y[i] + b.vy[i] * dt);
      // Float32 rounding can produce exactly 1; put that endpoint at zero.
      if (b.x[i] >= 1) b.x[i] = 0; if (b.y[i] >= 1) b.y[i] = 0;
    }
    sim.heat *= Math.exp(-0.45 * dt);
    for (const p of sim.pulses) p.remaining = Math.max(0, p.remaining - dt);
    sim.pulses = sim.pulses.filter(p => p.remaining > 1e-12);
  }

  function create(raw = defaults()) {
    const c = validateConfig(raw), sim = { config: c, time: 0, elapsed: 0, progress: 0, steps: 0, accumulator: 0 };
    if (c.mode !== 'soup') { sim.particles = particlesFor(c); sim.state = cosmicState(c, 0); return sim; }
    const size = c.grid, n = size * size;
    sim.size = size; sim.U = new Float32Array(n).fill(1); sim.V = new Float32Array(n);
    sim.nextU = new Float32Array(n); sim.nextV = new Float32Array(n);
    sim.beads = beadsFor(c); sim.forcing = forcingDefaults(); sim.pulses = [];
    sim.heat = 0; sim.zapCount = 0; sim.stirCount = 0; sim.magnetCount = 0;
    const rng = random(c.seed), count = 9;
    for (let k = 0; k < count; k++) {
      const x = k === 0 ? 0.5 : 0.15 + rng() * 0.7, y = k === 0 ? 0.5 : 0.15 + rng() * 0.7;
      inject(sim, x, y, 0.035 + rng() * 0.035);
    }
    // Small seeded perturbations break exact symmetries without ongoing noise.
    for (let i = 0; i < n; i++) if (sim.V[i] > 0) {
      sim.U[i] = 0.48 + rng() * 0.04;
      sim.V[i] = 0.22 + rng() * 0.06;
    }
    sim.state = { phase: 'Reaction–diffusion', progress: 0 };
    return sim;
  }

  function inject(sim, x, y, radius = 0.045) {
    if (!sim || sim.config.mode !== 'soup') throw Error('Catalyst injection is available in primordial soup.');
    if (![x, y, radius].every(Number.isFinite) || x < 0 || x > 1 || y < 0 || y > 1 || radius < 0.005 || radius > 0.25)
      throw Error('Invalid catalyst location or radius.');
    const n = sim.size, cx = x * n, cy = y * n, r = radius * n;
    for (let py = Math.floor(cy - r); py <= Math.ceil(cy + r); py++)
      for (let px = Math.floor(cx - r); px <= Math.ceil(cx + r); px++) if ((px - cx) ** 2 + (py - cy) ** 2 <= r * r) {
        const idx = ((py % n + n) % n) * n + (px % n + n) % n;
        sim.U[idx] = 0.5; sim.V[idx] = 0.26;
      }
    return sim;
  }

  function soupTick(sim) {
    const n = sim.size, { U, V, nextU, nextV, config: c } = sim;
    const mix = 0.35 + 0.9 * c.mixing, du = 0.16 * mix, dv = 0.08 * mix;
    const rate = 0.65 + 0.7 * c.energy;
    const thermal = (0.6 + 0.4 * c.temperature) * (1 + sim.heat * 0.25 + sim.forcing.electric * 0.08);
    const dt = 0.45;
    for (let y = 0; y < n; y++) {
      const up = (y === 0 ? n - 1 : y - 1) * n, down = (y === n - 1 ? 0 : y + 1) * n, row = y * n;
      for (let x = 0; x < n; x++) {
        const i = row + x, left = row + (x === 0 ? n - 1 : x - 1), right = row + (x === n - 1 ? 0 : x + 1);
        const u = U[i], v = V[i], reaction = rate * u * v * v;
        const lapU = U[left] + U[right] + U[up + x] + U[down + x] - 4 * u;
        const lapV = V[left] + V[right] + V[up + x] + V[down + x] - 4 * v;
        nextU[i] = clamp(u + dt * (du * lapU + thermal * (-reaction + c.feed * (1 - u))), 0, 1);
        nextV[i] = clamp(v + dt * (dv * lapV + thermal * (reaction - (c.feed + c.kill) * v)), 0, 1);
      }
    }
    sim.U = nextU; sim.V = nextV; sim.nextU = U; sim.nextV = V; sim.steps++;
  }

  function step(sim, dt) {
    if (!sim || !sim.config || typeof dt !== 'number' || !Number.isFinite(dt) || dt < 0 || dt > 10)
      throw Error('Simulation step must be finite and between zero and ten seconds.');
    const delta = dt * sim.config.speed;
    if (sim.config.mode !== 'soup') {
      sim.time = Math.min(sim.config.duration, sim.time + delta); sim.elapsed = sim.time;
      sim.progress = sim.time / sim.config.duration; sim.state = cosmicState(sim.config, sim.progress);
    } else {
      sim.time += delta; sim.elapsed = sim.time; sim.progress = clamp(sim.time / sim.config.duration, 0, 1);
      sim.accumulator += delta;
      const ticks = Math.floor((sim.accumulator + 1e-12) / FIXED_DT);
      for (let i = 0; i < ticks; i++) {
        const fields = stirFields(sim);
        advectSoup(sim, fields); soupTick(sim); soupTick(sim); beadTick(sim, fields);
      }
      sim.accumulator = Math.max(0, sim.accumulator - ticks * FIXED_DT);
      sim.state = { phase: 'Reaction–diffusion', progress: sim.progress };
    }
    return sim;
  }

  function seek(sim, progress) {
    if (!sim || sim.config.mode === 'soup') throw Error('Soup has history; restore a snapshot instead of seeking.');
    const state = cosmicState(sim.config, progress);
    sim.time = sim.config.duration * progress; sim.elapsed = sim.time;
    sim.progress = progress; sim.state = state;
    return sim;
  }

  function inspect(sim) {
    if (!sim || !sim.config) throw Error('Invalid Origins simulation.');
    const base = { mode: sim.config.mode, seed: sim.config.seed, time: sim.time, elapsed: sim.time,
      progress: sim.progress, steps: sim.steps, phase: sim.state.phase };
    if (sim.config.mode !== 'soup') return { ...base, ...sim.state, particles: sim.config.particles,
      units: sim.config.mode === 'bang' ? 'a relative to reference; H/H0; density/rho_crit,0; T/Tref' : 'dimensionless illustrative bounce' };
    let u = 0, v = 0, active = 0, reaction = 0;
    for (let i = 0; i < sim.U.length; i++) {
      u += sim.U[i]; v += sim.V[i];
      if (sim.V[i] > 0.1) active++;
      reaction += sim.U[i] * sim.V[i] * sim.V[i];
    }
    const cells = sim.U.length;
    const b = sim.beads, angle = sim.forcing.fieldAngle + (sim.forcing.polarity < 0 ? Math.PI : 0);
    let kineticEnergy = 0, alignment = 0, alignmentCount = 0, positive = 0, negative = 0, pn = 0, nn = 0;
    for (let i = 0; i < b.count; i++) {
      kineticEnergy += (b.vx[i] ** 2 + b.vy[i] ** 2) / 2;
      if (b.susceptibility[i]) { alignment += Math.cos(b.dipole[i] - angle); alignmentCount++; }
      const projection = periodicDelta(b.x[i] - sim.forcing.centerX) * Math.cos(sim.forcing.fieldAngle)
        + periodicDelta(b.y[i] - sim.forcing.centerY) * Math.sin(sim.forcing.fieldAngle);
      if (b.charge[i] > 0) { positive += projection; pn++; }
      if (b.charge[i] < 0) { negative += projection; nn++; }
    }
    return { ...base, meanU: u / cells, meanV: v / cells, activeFraction: active / cells,
      reaction: reaction / cells * (0.65 + 0.7 * sim.config.energy), size: sim.size,
      temperature: sim.config.temperature, cells, beadCount: b.count, kineticEnergy: kineticEnergy / b.count,
      chargeSeparation: (pn ? positive / pn : 0) - (nn ? negative / nn : 0),
      alignment: alignmentCount ? alignment / alignmentCount : 0, heat: sim.heat,
      zapCount: sim.zapCount, stirCount: sim.stirCount, magnetCount: sim.magnetCount,
      electric: sim.forcing.electric, stir: sim.forcing.stir, magnetic: sim.forcing.magnetic,
      units: 'dimensionless concentrations and coarse-grained beads; prebiotic-pattern toy' };
  }

  function encodeField(field) {
    const bytes = new Uint8Array(field.length * 4), view = new DataView(bytes.buffer);
    for (let i = 0; i < field.length; i++) view.setFloat32(i * 4, field[i], true);
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    let text = '';
    for (let start = 0; start < bytes.length; start += 8192)
      text += String.fromCharCode(...bytes.subarray(start, start + 8192));
    return btoa(text);
  }

  function decodeField(value, count, minimum = 0, maximum = 1) {
    if (typeof value !== 'string' || value.length !== Math.ceil(count * 4 / 3) * 4 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))
      throw Error('Invalid encoded soup concentration field.');
    let bytes;
    if (typeof Buffer !== 'undefined') bytes = new Uint8Array(Buffer.from(value, 'base64'));
    else { const binary = atob(value); bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0)); }
    if (bytes.length !== count * 4) throw Error('Incorrect saved soup field size.');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), field = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const v = view.getFloat32(i * 4, true);
      if (!Number.isFinite(v) || v < minimum || v > maximum) throw Error('Invalid saved numerical field.');
      field[i] = v;
    }
    return field;
  }

  function snapshot(sim) {
    const result = { schema: SCHEMA, config: { ...sim.config }, time: sim.time,
      accumulator: sim.accumulator, steps: sim.steps };
    if (sim.config.mode === 'soup') {
      result.encoding = 'float32-le/base64'; result.U = encodeField(sim.U); result.V = encodeField(sim.V);
      result.beads = { count: sim.beads.count };
      for (const key of BEAD_FIELDS) result.beads[key] = encodeField(sim.beads[key]);
      result.forcing = { ...sim.forcing }; result.pulses = sim.pulses.map(p => ({ ...p }));
      result.heat = sim.heat;
      for (const key of ['zapCount', 'stirCount', 'magnetCount']) result[key] = sim[key];
    }
    return result;
  }

  function restore(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || ![SCHEMA, LEGACY_SCHEMA].some(schema => B.isProtocol(raw.schema, schema))) throw Error('Unknown Origins state format.');
    const c = validateConfig(raw.config), sim = create(c);
    if (!Number.isFinite(raw.time) || raw.time < 0 || raw.time > 1e9 ||
      !Number.isFinite(raw.accumulator) || raw.accumulator < 0 || raw.accumulator >= FIXED_DT + 1e-9 ||
      !Number.isSafeInteger(raw.steps) || raw.steps < 0 || raw.steps > 1e12) throw Error('Invalid saved simulation clock.');
    if (c.mode !== 'soup') {
      if (raw.time > c.duration) throw Error('Saved cosmic time exceeds the timeline.');
      seek(sim, raw.time / c.duration);
    } else {
      const count = c.grid * c.grid;
      if (raw.encoding !== 'float32-le/base64') throw Error('Unknown saved soup field encoding.');
      for (const field of ['U', 'V']) {
        sim[field] = decodeField(raw[field], count);
      }
      sim.time = raw.time; sim.elapsed = raw.time; sim.progress = clamp(raw.time / c.duration, 0, 1);
      sim.state = { phase: 'Reaction–diffusion', progress: sim.progress };
      if (B.isProtocol(raw.schema, SCHEMA)) restoreLaboratory(sim, raw);
    }
    sim.accumulator = raw.accumulator; sim.steps = raw.steps;
    return sim;
  }

  function restoreLaboratory(sim, raw) {
    const n = sim.config.beadCount;
    if (!raw.beads || raw.beads.count !== n) throw Error('Invalid saved bead count.');
    const beadBounds = { x: [0, 1], y: [0, 1], vx: [-2, 2], vy: [-2, 2], charge: [-1, 1], dipole: [0, 2 * Math.PI + 1e-6], susceptibility: [0, 1], kind: [0, 2] };
    for (const key of BEAD_FIELDS) {
      const field = decodeField(raw.beads[key], n, beadBounds[key][0], beadBounds[key][1]);
      if (key === 'kind' && !field.every(v => Number.isInteger(v))) throw Error('Invalid saved bead species.');
      if (['x', 'y'].includes(key) && field.some(v => v >= 1)) throw Error('Saved bead lies outside the periodic patch.');
      sim.beads[key] = key === 'kind' ? new Uint8Array(field) : field;
    }
    sim.forcing = forcingValue(raw.forcing);
    if (!Number.isFinite(raw.heat) || raw.heat < 0 || raw.heat > 3) throw Error('Invalid saved activation heat.');
    sim.heat = raw.heat;
    for (const key of ['zapCount', 'stirCount', 'magnetCount']) {
      if (!Number.isSafeInteger(raw[key]) || raw[key] < 0 || raw[key] > 1e9) throw Error('Invalid saved interaction count.');
      sim[key] = raw[key];
    }
    if (!Array.isArray(raw.pulses) || raw.pulses.length > 12) throw Error('Invalid saved field pulses.');
    sim.pulses = raw.pulses.map(p => {
      if (!p || !['zap', 'stir', 'magnet'].includes(p.type) ||
        !['x', 'y', 'strength'].every(key => Number.isFinite(p[key]) && p[key] >= 0 && p[key] <= 1) ||
        !Number.isFinite(p.total) || p.total <= 0 || p.total > 2.5 || !Number.isFinite(p.remaining) || p.remaining <= 0 || p.remaining > p.total ||
        !Number.isFinite(p.angle) || p.angle < 0 || p.angle > 2 * Math.PI || ![-1, 1].includes(p.polarity)) throw Error('Invalid saved field pulse.');
      return { type: p.type, x: p.x, y: p.y, strength: p.strength, remaining: p.remaining, total: p.total, angle: p.angle, polarity: p.polarity };
    });
  }

  const api = Object.freeze({ SCHEMA, LEGACY_SCHEMA, MODES, bounds, FIXED_DT, soupPresets, defaults, eras, eraProgress,
    validateConfig, random, create, step, inspect, cosmicState, seek, inject, snapshot, restore,
    interact, setForcing, forcingDefaults, lorentzRotate });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TRIScoreOriginsCore = api;
})(globalThis);
