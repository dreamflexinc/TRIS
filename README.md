# TRIS

## Android download

**[Download TRIScore 1.1 for Android (APK)](https://github.com/dreamflexinc/TRIS/releases/download/android-v1.1.0-preview/TRIScore_1.1.apk)**

Requires Android 10 or newer. Download the APK on your Android device and open it to install. This is the original 1.1 science lab preview build, published unchanged.

[Release notes](https://github.com/dreamflexinc/TRIS/releases/tag/android-v1.1.0-preview) · [SHA-256 checksum](https://github.com/dreamflexinc/TRIS/releases/download/android-v1.1.0-preview/TRIScore_1.1.apk.sha256)

## Windows download

**[TRIScore 4.3.3 for Windows ARM64](https://github.com/dreamflexinc/TRIS/releases/download/v4.3.3/TRIScore_4.3.3_Aero_Windows_ARM64.exe)** · **[TRIScore 4.3.3 for Windows x64](https://github.com/dreamflexinc/TRIS/releases/download/v4.3.3/TRIScore_4.3.3_Aero_Windows_x64.exe)**

Choose ARM64 for Windows on ARM, or x64 for Intel/AMD Windows. These are portable, self-contained, unsigned executables. An installed **Microsoft Edge WebView2 Runtime** is required.

Close the earlier desktop app before launching this version. Existing desktop profiles, saved work, and custom colors are preserved; the earlier profile remains intact. See the [desktop notes](DESKTOP.md) for details.

[Windows release notes](https://github.com/dreamflexinc/TRIS/releases/tag/v4.3.3) · [SHA-256 checksums](https://github.com/dreamflexinc/TRIS/releases/download/v4.3.3/TRIScore_4.3.3_SHA256SUMS.txt) · [Windows source package](https://github.com/dreamflexinc/TRIS/releases/download/v4.3.3/TRIScore_4.3.3_Source.zip)

![TRIScore Windows workbench with Cosmic Origins](docs/images/triscore-desktop.png)

### Windows workbench

- Big Bang epochs from hot plasma to the cosmic web, plus an illustrative Big Bounce model.
- A primordial-soup sandbox with charged/dipolar beads, reaction–diffusion fields, and **Zap**, **Stir**, **Magnet**, and **Seed** tools.
- Manifold Atlas, Topology, Force Fields, Collider, Capsules, encrypted Tris continuity, notebooks, and saved experiments with JSON/PNG exports.
- Independent light/dark palettes, graph colors, HEX/RGB controls, line styles, and Aero-style window chrome that follows the theme.

These are educational models. The soup uses abstract bead dynamics and concentration fields; the bounce is speculative. See the [model equations and limits](ORIGINS-MODELS.md).

The Windows release passed **92 unit checks, 10 browser checks, and 48 native checks**. ARM64 was tested natively on Windows ARM; x64 was tested under emulation on the same computer. Separate Intel/AMD hardware was not tested. See the [release report](RELEASE-REPORT.txt).

### Windows source and builds

The Windows source lives at the repository root: [desktop host](desktop/), [simulation and interface modules](src/), and [tests](tests/). Follow the [build instructions](DESKTOP.md), using Node.js 22+ and the .NET SDK pinned in [global.json](global.json).

```powershell
npm ci
npm run build
npm test
```

The Android APK remains a separate, unchanged preview release. The Windows source and build instructions do not reproduce that APK; its [release notes](https://github.com/dreamflexinc/TRIS/releases/tag/android-v1.1.0-preview) describe the Android package and source limitations.

## About TRIS

TRIS is an interactive science lab for exploring physics, chemistry, and cosmic origins. Experiment with Big Bang and Big Bounce models, primordial soup, quantum systems, relativity, and higher-dimensional geometry—all through live visualizations, adjustable parameters, saved experiments, and a customizable interface that runs locally.
