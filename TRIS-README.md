# TRIScore 3.0 — Tris Native

A runnable continuation of **TRIScore 2.0 / Convergence**, built from the recovered standalone HTML. Tris Native adds encrypted, portable agent continuity to the existing Goblin/TRIScore workbench. It is application state, not a claim of consciousness, a trained model, or replacement operating-system firmware.

## Run

Requires Node.js 22 or later and a modern browser with Web Crypto and IndexedDB. No production package installation is needed.

On Windows, double-click **Start-TRIScore.cmd**. It starts the local server and opens your browser, using installed Node or the bundled Codex runtime when available. Keep its console open while using the app. Alternatively:

```powershell
node scripts/serve.cjs
```

Open **http://127.0.0.1:8763**, then choose **Tris** in the navigation. Keep using that exact address and port: browser state belongs to the origin. `localhost` and `127.0.0.1` are different origins. A direct `file://` launch may render, but browser storage and crypto behavior there are not the supported persistence path.

1. Create an identity with a unique passphrase of at least 15 characters.
2. Save long-term, episodic, or project memories. Profile and preferences have separate editors.
3. Under **Backups & recovery**, download an encrypted backup. Keep it outside the browser and keep its password separately.
4. After a reload or reboot, open the same address and unlock. The stored identity mounts into a fresh session.
5. Grant console identity access under **Services & audit** if desired. Other services start with no access.

The static server binds only to loopback. It has no state endpoint and cannot read browser memories. The bundle retains the original network-blocking policy. Sentinel's seal control, page exit, hiding the app, and five minutes of inactivity all seal Tris and discard unsaved drafts. Keys are never stored in localStorage, IndexedDB, exported JSON, or a config file.

## What is included

- Immutable identity ID, creation time, and identity kind; editable display profile.
- Versioned memories with provenance, timestamps, project grouping, and explicit untrusted-data classification.
- Preferences, durable capability descriptions, and a deny-by-default service permissions registry.
- AES-256-GCM storage; PBKDF2-HMAC-SHA256 key derivation with 600,000 iterations and a fresh 32-byte salt. Every save has a fresh 12-byte nonce and authenticated envelope metadata.
- Atomic encrypted saves, conflicting-writer detection, schema validation and migrations, encrypted snapshots, rollback, backup import/export, and passphrase rotation.
- An encrypted, hash-chained audit trail and owner controls for edit, delete, reset, integrity verification, and sealed-storage recovery.
- Browser persistence and an optional native Node file adapter, plus a boot/mount adapter for trusted host services.

All **43 original script blocks remain byte-identical**. Existing simulation calculations, journals, Sentinel notebooks, and saved Goblin preferences are not automatically copied into Tris. This recovered source does not include the old APK builder or the desktop chemistry worker; no new APK is claimed.

## Source and verification

```powershell
node scripts/build.cjs
node --test tests/core.test.cjs
```

`src/` contains the state engine, adapters, and interface. `base/` preserves the exact 2.0 input. The build verifies its SHA-256, adds Tris, regenerates the Content Security Policy hashes, and writes `TRIScore3_TrisNative.html` and `BUILD-MANIFEST.json`.

Browser tests use Playwright 1.62.1 and Microsoft Edge by default:

```powershell
npm install --no-save playwright@1.62.1
node tests/browser.cjs
```

Set `TRIS_BROWSER_PATH` to test a different installed Chromium browser. Tests create isolated browser profiles and synthetic memories; they do not read your real TRIScore data. See [TEST-REPORT.md](TEST-REPORT.md), [MIGRATION.md](MIGRATION.md), and [ARCHITECTURE.md](ARCHITECTURE.md).

## Integration provenance

Base file: `TRIScore2_Convergence.html` from the user's Downloads, SHA-256 `bed22a23c9c79885bfe64a28b42c228033efe5586944369f0a5d409fd9233392`. The user confirmed TRIScore 2.0 was the latest version. No upstream repository or branch was available. This is an additive source release against that recovered 2.0 build, not a claim of an upstream merge.

The local source checkout records the untouched input on `recovered-triscore-2.0` and the implementation on `triscore-3.0-tris-native`. The source ZIP contains the runnable files; the accompanying Git bundle preserves both branches for review or future integration.
