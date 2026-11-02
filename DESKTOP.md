# TRIScore 4.3.3 — Windows desktop

ARM64 and x64 self-contained portable EXEs are supplied. Choose ARM64 for Windows on ARM or x64 for Intel/AMD Windows. Microsoft Edge WebView2 Runtime must already be installed. No Node installation, local server, service, startup task, or installer is needed.

The native title, menus, download names, app metadata, source names, and release files use TRIScore. The Aero caption and real File/Help menus follow Color Studio settings. The application keeps a private secure local browser partition for compatibility with encrypted data; no address bar or external network service is involved.

## Existing data

TRIScore stores its profile in `%LOCALAPPDATA%\TRIScore\CosmicOrigins\Profile`. On its first normal launch, it copies the earlier desktop profile after that application closes. The original profile stays intact. A private instance lock and read leases prevent copying an active browser database. The copy is staged and published atomically; an existing TRIScore profile is never replaced. Regenerable caches are omitted while encrypted IndexedDB records, local storage, browser key state, and preferences are retained.

Close the earlier desktop app before the first TRIScore launch. Native errors explain when an earlier browser is still closing. Keep encrypted Tris backups for transfer to another device. Browser versions and unrelated branches have separate storage and require explicit export/import.

## Build

Run `node scripts/build.cjs`, then `desktop/Build-Desktop.ps1 -Runtime win-arm64` or `-Runtime win-x64`. Pass `-Dotnet` to choose an SDK outside PATH. The build uses .NET SDK 10.0.401, bundled .NET 10.0.12, and WebView2 SDK 1.0.4258.31 from the committed lockfile. The script verifies the HTML digest before publishing. Architecture builds run sequentially because generated build files are shared.

The EXEs are unsigned. The offline HTML is another runnable format. Microsoft's official WebView2 page is https://developer.microsoft.com/en-us/microsoft-edge/webview2/ .

## Isolated verification

Every verification process uses a new scratch directory, never the normal user profile.

```powershell
.\TRIScore_4.3.3_Aero_Windows_ARM64.exe --smoke-dir C:\scratch\profile-unit --smoke-stage profile-copy-tests
.\TRIScore_4.3.3_Aero_Windows_ARM64.exe --smoke-dir C:\scratch\chrome-test --smoke-stage chrome
.\TRIScore_4.3.3_Aero_Windows_ARM64.exe --smoke-dir C:\scratch\origins-test --smoke-stage origins
.\TRIScore_4.3.3_Aero_Windows_ARM64.exe --smoke-dir C:\scratch\origins-test --smoke-stage origins-reopen
```

Wait for each process to exit. Tests cover active-profile exclusion, source preservation, atomic copy behavior, all caption hit regions, work-area maximize geometry, theme synchronization, simulations, full-state restoration, and native JSON/PNG downloads. The `profile-reopen` stage copies an existing synthetic fixture from its scratch directory's `previous\profile` subfolder, then verifies the same encrypted identity and memory through the actual TRIScore UI. It never opens the normal user vault.

`atlas` / `atlas-reopen`, `create` / `reopen` / `import`, and `origins-legacy` remain available for the retained labs and reviewed compatibility import. The bundled fixture contains generated concentrations and synthetic notes only. Native tests run on Windows ARM64; x64 runs use emulation on that machine. A separate physical Intel/AMD device has not been used.
