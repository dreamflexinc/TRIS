const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/origins-core.js');

test('Big Bang expands and cools monotonically with a finite normalized density', () => {
  for (const omegaMatter of [0, 0.315, 1]) {
    const c = { ...C.defaults(), omegaMatter, omegaLambda: 1 - omegaMatter };
    let previous = C.cosmicState(c, 0);
    for (let i = 1; i <= 200; i++) {
      const state = C.cosmicState(c, i / 200);
      assert(state.a > previous.a);
      assert(state.temperature < previous.temperature);
      assert(state.density <= previous.density);
      assert(state.hubble > 0);
      assert(Math.abs(state.matterFraction + state.radiationFraction + state.lambdaFraction - 1) < 1e-12);
      for (const key of ['a', 'hubble', 'density', 'temperature', 'age']) assert(Number.isFinite(state[key]));
      previous = state;
    }
  }
});

test('numerical expansion history satisfies the differential Friedmann equation', () => {
  const c = C.defaults(), epsilon = 0.00001;
  for (const p of [0.05, 0.2, 0.5, 0.8, 0.95]) {
    const before = C.cosmicState(c, p - epsilon), after = C.cosmicState(c, p + epsilon), middle = C.cosmicState(c, p);
    const derivative = (after.a - before.a) / (after.age - before.age);
    assert(Math.abs(derivative / (middle.a * middle.hubble) - 1) < 0.008);
  }
});

test('relative density equals squared H/H0 in the flat expanding model', () => {
  for (const p of [0, 0.1, 0.3, 0.6, 1]) {
    const s = C.cosmicState(C.defaults(), p);
    assert(Math.abs(s.hubble ** 2 / s.density - 1) < 1e-12);
  }
});

test('bounce contracts to the requested nonzero minimum then re-expands without divergent state', () => {
  for (const bounceMin of [0.02, 0.12, 0.6]) {
    const c = { ...C.defaults('bounce'), bounceMin };
    const initial = C.cosmicState(c, 0), middle = C.cosmicState(c, 0.5), end = C.cosmicState(c, 1);
    assert.equal(initial.a, 1); assert.equal(middle.a, bounceMin); assert.equal(end.a, 1); assert.equal(middle.hubble, 0);
    assert(middle.density > initial.density);
    for (let i = 0; i <= 100; i++) {
      const p = i / 100, s = C.cosmicState(c, p), mirror = C.cosmicState(c, 1 - p);
      assert(s.a >= bounceMin - 1e-15); assert(Math.abs(s.a - mirror.a) < 1e-14);
      if (p > 0 && p < 0.5) assert(s.hubble < 0);
      if (p > 0.5 && p < 1) assert(s.hubble > 0);
      for (const key of ['a', 'hubble', 'density', 'temperature']) assert(Number.isFinite(s[key]));
    }
  }
});

test('same seed yields reproducible tracers and soup, while different seeds change initial conditions', () => {
  for (const mode of C.MODES) {
    const a = C.create(C.defaults(mode)), b = C.create(C.defaults(mode)), other = C.create({ ...C.defaults(mode), seed: 43 });
    const field = mode === 'soup' ? 'V' : 'particles';
    assert.deepEqual(a[field], b[field]); assert.notDeepEqual(a[field], other[field]);
  }
});

test('seed zero remains a usable deterministic random sequence', () => {
  const a = C.random(0), b = C.random(0), values = Array.from({ length: 100 }, () => a());
  assert(values.every(n => n >= 0 && n < 1)); assert(new Set(values).size > 90);
  assert.deepEqual(values, Array.from({ length: 100 }, () => b()));
});

test('soup advances deterministically independent of frame partition', () => {
  const c = { ...C.defaults('soup'), grid: 40 }, a = C.create(c), b = C.create(c);
  C.step(a, 1);
  for (let i = 0; i < 100; i++) C.step(b, 0.01);
  assert.equal(a.steps, 120); assert.equal(b.steps, 120);
  assert.deepEqual(a.U, b.U); assert.deepEqual(a.V, b.V);
  const forcedA = C.create(c), forcedB = C.create(c);
  for (const s of [forcedA, forcedB]) {
    C.setForcing(s, { electric: 0.4, magnetic: 0.7, stir: -0.3 });
    C.interact(s, { type: 'zap', strength: 0.7 }); C.interact(s, { type: 'stir', strength: 0.5 });
  }
  C.step(forcedA, 1); for (let i = 0; i < 100; i++) C.step(forcedB, 0.01);
  assert.deepEqual(forcedA.U, forcedB.U); assert.deepEqual(forcedA.V, forcedB.V);
  assert.deepEqual(forcedA.beads, forcedB.beads); assert.deepEqual(forcedA.pulses, forcedB.pulses);
  assert.equal(forcedA.heat, forcedB.heat);
});

test('reaction diffusion genuinely evolves and all soup presets retain patterned activity', () => {
  for (const preset of C.soupPresets) {
    const s = C.create({ ...C.defaults('soup'), ...preset });
    const before = new Float32Array(s.V);
    C.step(s, 10); C.step(s, 10);
    assert.notDeepEqual(s.V, before);
    const metrics = C.inspect(s);
    assert(metrics.activeFraction > 0.05 && metrics.activeFraction < 0.95);
    assert(metrics.meanU > 0 && metrics.meanU < 1); assert(metrics.meanV > 0 && metrics.meanV < 1);
    assert(s.U.every(Number.isFinite)); assert(s.V.every(Number.isFinite));
    assert(s.U.every(x => x >= 0 && x <= 1)); assert(s.V.every(x => x >= 0 && x <= 1));
  }
});

test('unperturbed feed solution is a stable exact numerical equilibrium', () => {
  const s = C.create({ ...C.defaults('soup'), grid: 40 }); s.U.fill(1); s.V.fill(0);
  C.step(s, 1);
  assert(s.U.every(n => n === 1)); assert(s.V.every(n => n === 0));
});

test('periodic diffusion has no special boundary edge', () => {
  const c = { ...C.defaults('soup'), grid: 40 }, a = C.create(c), b = C.create(c), n = a.size;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x, shifted = y * n + (x + 1) % n;
    b.U[shifted] = a.U[i]; b.V[shifted] = a.V[i];
  }
  C.step(a, 0.1); C.step(b, 0.1);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x, shifted = y * n + (x + 1) % n;
    assert.equal(b.U[shifted], a.U[i]); assert.equal(b.V[shifted], a.V[i]);
  }
});

test('catalyst brushes wrap at the boundary and leave the clock untouched', () => {
  const s = C.create({ ...C.defaults('soup'), grid: 40 }); s.U.fill(1); s.V.fill(0);
  C.inject(s, 0, 0, 0.06);
  assert(s.V[0] > 0); assert(s.V[s.size - 1] > 0); assert(s.V[(s.size - 1) * s.size] > 0);
  assert.equal(s.time, 0); assert.equal(s.steps, 0);
});

test('cosmic playback stops at the end and explicit seek restores consistent clock and state', () => {
  const s = C.create({ ...C.defaults('bounce'), duration: 10, speed: 8 });
  C.step(s, 10); assert.equal(s.time, 10); assert.equal(s.progress, 1);
  C.seek(s, 0.5); assert.equal(s.time, 5); assert.equal(s.state.a, s.config.bounceMin);
  assert.throws(() => C.seek(C.create(C.defaults('soup')), 0.5));
});

test('state export restores exact floating fields and future evolution, in compact encoding', () => {
  for (const mode of C.MODES) {
    const s = C.create({ ...C.defaults(mode), grid: 40 }); C.step(s, 0.073);
    const raw = C.snapshot(s), text = JSON.stringify(raw), restored = C.restore(JSON.parse(text));
    assert.deepEqual(C.inspect(restored), C.inspect(s));
    if (mode === 'soup') {
      assert(text.length < 30000); assert.deepEqual(restored.U, s.U); assert.deepEqual(restored.V, s.V);
      assert.notEqual(restored.U, s.U);
    }
    C.step(s, 0.39); C.step(restored, 0.39);
    assert.deepEqual(C.snapshot(restored), C.snapshot(s));
  }
});

test('hostile settings, enormous allocations and invalid clock steps are rejected', () => {
  for (const config of [null, [], { mode: 'plasma' }, { grid: 10000000 }, { particles: 1e9 },
    { speed: Infinity }, { feed: NaN }, { seed: -1 }, { seed: 1.2 }, { omegaMatter: -1 }, { bounceMin: 0 }])
    assert.throws(() => C.validateConfig(config));
  const s = C.create();
  for (const dt of [-1, Infinity, NaN, 11, '1']) assert.throws(() => C.step(s, dt));
  for (const p of [-0.1, 1.1, Infinity, NaN]) assert.throws(() => C.cosmicState(C.defaults(), p));
});

test('malformed imports fail before applying data and cannot inject nonfinite concentrations', () => {
  const original = C.snapshot(C.create({ ...C.defaults('soup'), grid: 40 }));
  for (const patch of [{ schema: 'future' }, { U: 'not-base64' }, { U: original.U.slice(4) },
    { time: -1 }, { accumulator: 1 }, { steps: -1 }, { config: { ...original.config, grid: 16000 } }])
    assert.throws(() => C.restore({ ...original, ...patch }));
  const bytes = Buffer.from(original.U, 'base64'); bytes.writeFloatLE(NaN, 0);
  assert.throws(() => C.restore({ ...original, U: bytes.toString('base64') }));
  assert.equal(original.U, C.snapshot(C.create({ ...C.defaults('soup'), grid: 40 })).U);
});

test('extreme allowed reaction settings stay finite and bounded', () => {
  const s = C.create({ ...C.defaults('soup'), grid: 40, temperature: 3, energy: 1, mixing: 1, feed: 0.09, kill: 0.08 });
  C.step(s, 10);
  assert(s.U.every(x => Number.isFinite(x) && x >= 0 && x <= 1));
  assert(s.V.every(x => Number.isFinite(x) && x >= 0 && x <= 1));
});

test('electric fields accelerate opposite charges oppositely and leave neutral beads unforced', () => {
  const s = C.create({ ...C.defaults('soup'), grid: 40 }), b = s.beads;
  for (let i = 0; i < 3; i++) { b.x[i] = b.y[i] = 0.5; b.vx[i] = b.vy[i] = 0; b.susceptibility[i] = 0; }
  b.charge[0] = 1; b.charge[1] = -1; b.charge[2] = 0;
  C.setForcing(s, { electric: 1 }); C.step(s, 0.5);
  assert(b.vx[0] > 0.3); assert(b.vx[1] < -0.3); assert.equal(b.vx[2], 0);
  assert(Math.abs(b.vx[0] + b.vx[1]) < 1e-6);
  assert(b.x[0] > 0.5 && b.x[1] < 0.5); assert.equal(b.x[2], 0.5);
});

test('isolated Lorentz rotation preserves kinetic energy and reverses with charge/polarity', () => {
  for (const q of [-1, 1]) for (const magnetic of [-10, -1, 1, 10]) {
    const v = C.lorentzRotate(0.8, -0.3, q, magnetic, 0.17);
    assert(Math.abs(v[0] ** 2 + v[1] ** 2 - 0.73) < 1e-12);
    const undo = C.lorentzRotate(v[0], v[1], q, -magnetic, 0.17);
    assert(Math.abs(undo[0] - 0.8) < 1e-12 && Math.abs(undo[1] + 0.3) < 1e-12);
  }
});

test('magnetic deflection alone adds no bead kinetic energy beyond matched solvent drag', () => {
  const a = C.create({ ...C.defaults('soup'), grid: 40 }), b = C.restore(C.snapshot(a));
  a.beads.susceptibility.fill(0); b.beads.susceptibility.fill(0);
  C.setForcing(b, { magnetic: 1 }); C.step(a, 0.5); C.step(b, 0.5);
  const ka = C.inspect(a).kineticEnergy, kb = C.inspect(b).kineticEnergy;
  assert(Math.abs(kb / ka - 1) < 2e-6);
  assert.notDeepEqual(a.beads.vx, b.beads.vx);
});

test('stirring creates opposite tangential velocities across the vortex and advects real concentrations', () => {
  const a = C.create({ ...C.defaults('soup'), grid: 40 }), baseline = C.restore(C.snapshot(a)), beads = a.beads;
  beads.x[0] = 0.7; beads.y[0] = 0.5; beads.x[1] = 0.3; beads.y[1] = 0.5;
  beads.vx[0] = beads.vx[1] = beads.vy[0] = beads.vy[1] = 0;
  C.interact(a, { type: 'stir', x: 0.5, y: 0.5, strength: 1 });
  assert(beads.vy[0] > 0 && beads.vy[1] < 0);
  C.step(a, 0.5); C.step(baseline, 0.5);
  assert.notDeepEqual(a.V, baseline.V); assert.equal(C.inspect(a).stirCount, 1);
});

test('magnetic polarity reverses dipole alignment while neutral nonmagnetic beads stay unaffected', () => {
  const plus = C.create({ ...C.defaults('soup'), grid: 40 }), minus = C.restore(C.snapshot(plus));
  for (const s of [plus, minus]) {
    s.beads.x[0] = 0.55; s.beads.y[0] = 0.5; s.beads.dipole[0] = Math.PI / 2;
    s.beads.charge[0] = 0; s.beads.susceptibility[0] = 1; s.beads.vx[0] = s.beads.vy[0] = 0;
  }
  C.setForcing(plus, { magnetic: 1, polarity: 1 }); C.setForcing(minus, { magnetic: 1, polarity: -1 });
  C.step(plus, 0.5); C.step(minus, 0.5);
  assert(Math.cos(plus.beads.dipole[0]) > 0.8); assert(Math.cos(minus.beads.dipole[0]) < -0.8);
});

test('zap changes local chemical fields and actual bead velocity with a decaying activation pulse', () => {
  const s = C.create({ ...C.defaults('soup'), grid: 40 }), before = new Float32Array(s.V);
  s.beads.x[1] = s.beads.y[1] = 0.5; s.beads.vx[1] = 0; s.beads.charge[1] = 1;
  C.interact(s, { type: 'zap', strength: 1 });
  assert(s.beads.vx[1] > 0.5); assert.notDeepEqual(s.V, before); assert.equal(s.zapCount, 1); assert(s.heat > 0);
  const heat = s.heat; C.step(s, 1); assert(s.heat < heat); assert.equal(s.pulses.length, 0);
});

test('full laboratory snapshot resumes exact fields, beads, pulses and forcing deterministically', () => {
  const a = C.create({ ...C.defaults('soup'), grid: 40 });
  C.setForcing(a, { electric: 0.4, stir: -0.3, magnetic: 0.8, polarity: -1, fieldAngle: 2 });
  for (const type of ['zap', 'stir', 'magnet']) C.interact(a, { type, x: 0.6, y: 0.4, strength: 0.7 });
  C.step(a, 0.123);
  const saved = JSON.parse(JSON.stringify(C.snapshot(a))), b = C.restore(saved);
  assert.deepEqual(C.snapshot(a), C.snapshot(b));
  C.step(a, 0.37); C.step(b, 0.37); assert.deepEqual(C.snapshot(a), C.snapshot(b));
});

test('v1 soup snapshots migrate with exact old fields and clocks, adding reproducible zero-field beads', () => {
  // Compressed actual TRIScore4.2 v1 snapshot: seed42,40grid,0.345seconds.
  const raw = JSON.parse(require('node:zlib').inflateRawSync(Buffer.from('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', 'base64')));
  const migrated = C.restore(raw);
  assert(require('../src/brand-compat.js').isProtocol(raw.schema, C.LEGACY_SCHEMA));
  const restored = C.snapshot(migrated);
  assert.equal(restored.U, raw.U); assert.equal(restored.V, raw.V);
  assert.equal(migrated.time, raw.time); assert.equal(migrated.accumulator, raw.accumulator); assert.equal(migrated.steps, raw.steps);
  assert.deepEqual(migrated.forcing, C.forcingDefaults()); assert.equal(migrated.beads.count, 240);
  C.step(migrated, 0.25);
  const future = C.snapshot(migrated), hash = s => require('node:crypto').createHash('sha256').update(s).digest('hex');
  // These hashes were computed with the original unmodified4.2 engine.
  assert.equal(hash(future.U), 'fa087a8f505f37e8c26371c69cc3d6e2da315a56aff1a9fbed6b43270ca6da5b');
  assert.equal(hash(future.V), '4ae2665ca1cf4614e94a6cfd4bea7f64f4e1d13f3a73e008367d9e500602efc5');
});

test('each Big Bang era seek lands on its correct scale factor and physical readouts are finite', () => {
  for (const omegaMatter of [0.2, 0.315, 0.6]) {
    const c = { ...C.defaults(), omegaMatter, omegaLambda: 1 - omegaMatter };
    let previous = -1;
    for (const e of C.eras) {
      const p = C.eraProgress(c, e.id), s = C.cosmicState(c, p);
      assert(p > previous); assert(Math.abs(s.a / e.aMin - 1) < 1e-10);
      assert.equal(s.era.id, e.id); assert(s.ageSeconds > 0); assert(s.tempKelvin > 0); assert(Number.isFinite(s.redshift));
      previous = p;
    }
  }
  assert.equal(C.cosmicState(C.defaults(), 0).a, 1e-15);
  assert.equal(C.cosmicState(C.defaults('bounce'), 0.5).ageSeconds, null);
});

test('laboratory import and tool controls reject corrupt or unbounded state', () => {
  const s = C.create({ ...C.defaults('soup'), grid: 40 }), state = C.snapshot(s);
  for (const forcing of [{ electric: 100 }, { stir: NaN }, { magnetic: -1 }, { fieldAngle: Infinity }, { polarity: 0 }])
    assert.throws(() => C.setForcing(s, forcing));
  for (const interaction of [{ type: 'boom' }, { type: 'zap', strength: Infinity }, { type: 'stir', x: -1 }])
    assert.throws(() => C.interact(s, interaction));
  assert.throws(() => C.restore({ ...state, heat: Infinity }));
  assert.throws(() => C.restore({ ...state, beads: { ...state.beads, count: 1e9 } }));
  assert.throws(() => C.restore({ ...state, pulses: Array(1000).fill({}) }));
});
