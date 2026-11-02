/* TRIScore compatibility for existing opaque storage and versioned wire formats. */
(function (root) {
  'use strict';
  const previous = String.fromCharCode(116, 97, 114, 100, 105, 115);
  const current = 'triscore';
  const keySuffixes = Object.freeze(['-sentinel-vault-v1', '-manifold-atlas-v1',
    '-inferno-theme-v1', '-inferno-previous-appearance-v1', '-inferno-origins-v2', '-cosmic-origins-v1']);
  const protocols = Object.freeze(['.vault.v1', '.vault.text.v1', '.accelerator.recipe.v1',
    '.frontier.recipe.v1', '.convergence.capsule.v1', '.convergence.science.v1',
    '.topology.export.v1', '.topology.observation.v1', '.inferno.appearance-backup.v1',
    '.origins.library.v1', '-origins-state/v1', '-origins-state/v2', '-manifold-atlas/v1']);

  function legacyName(style = 'lower') {
    if (style === 'upper') return previous.toUpperCase();
    if (style === 'title') return previous[0].toUpperCase() + previous.slice(1);
    if (style !== 'lower') throw Error('Unknown compatibility-name style.');
    return previous;
  }
  function legacyProtocol(value) {
    if (typeof value !== 'string') return value;
    if (protocols.some(suffix => value === current + suffix)) return previous + value.slice(current.length);
    if (value === 'org.triscoreos.convergence.v2') return 'org.' + previous + 'os.convergence.v2';
    return value;
  }
  function isProtocol(actual, expected) {
    return typeof actual === 'string' && (actual === expected || actual === legacyProtocol(expected));
  }
  function canonicalProtocol(value) {
    if (typeof value !== 'string') return value;
    for (const suffix of protocols) if (value === previous + suffix) return current + suffix;
    if (value === 'org.' + previous + 'os.convergence.v2') return 'org.triscoreos.convergence.v2';
    return value;
  }
  function physicalStorageKey(value) {
    const key = String(value);
    for (const suffix of keySuffixes) if (key === current + suffix) return previous + suffix;
    return key;
  }
  function logicalStorageKey(value) {
    if (value === null) return null;
    for (const suffix of keySuffixes) if (value === previous + suffix) return current + suffix;
    return value;
  }
  function databaseName(value) {
    return value === 'triscore-tris-native' ? previous + '-tris-native' : value;
  }
  function displayId(value) {
    if (typeof value !== 'string') return value;
    if (value.startsWith(previous + '.')) return current + value.slice(previous.length);
    return canonicalProtocol(value);
  }
  function installStorage(proto) {
    if (!proto) return false;
    const marker = Symbol.for('triscore.brand.storage-alias.v1');
    if (Object.prototype.hasOwnProperty.call(proto, marker)) return true;
    const original = Object.fromEntries(['getItem', 'setItem', 'removeItem', 'key'].map(name => [name, proto[name]]));
    if (!['getItem', 'setItem', 'removeItem'].every(name => typeof original[name] === 'function')) return false;
    Object.defineProperties(proto, {
      getItem: { configurable: true, writable: true, value: function (key) { return original.getItem.call(this, physicalStorageKey(key)); } },
      setItem: { configurable: true, writable: true, value: function (key, value) { return original.setItem.call(this, physicalStorageKey(key), value); } },
      removeItem: { configurable: true, writable: true, value: function (key) { return original.removeItem.call(this, physicalStorageKey(key)); } }
    });
    if (typeof original.key === 'function') Object.defineProperty(proto, 'key', {
      configurable: true, writable: true, value: function (index) { return logicalStorageKey(original.key.call(this, index)); }
    });
    Object.defineProperty(proto, marker, { value: Object.freeze(original) });
    return true;
  }

  const api = Object.freeze({ legacyName, legacyProtocol, isProtocol, canonicalProtocol,
    physicalStorageKey, logicalStorageKey, databaseName, displayId, installStorage });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.TRIScoreBrandCompat = api; if (typeof root.Storage === 'function') installStorage(root.Storage.prototype); }
})(globalThis);
