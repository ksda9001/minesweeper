# 草地扫雷 / Realistic Minesweeper

Fullscreen classic Minesweeper on a 3D grass field. Web, Windows (Tauri 2), Android (Capacitor).
No accounts, leaderboard, backend, remote score storage, or iOS project.

## Play

- Beginner: 9×9, 10 mines. Intermediate: 16×16, 40 mines. Expert: 30×16, 99 mines (16×30 on phones).
- Custom: sides at least 5, longer side at most 40, shorter side at most 30, mines 1–(cells−9). Wide fields open in portrait on phones.
- Phone layouts fill the available screen. Cells stay square in every preset, custom field, zoom level, and screen size; the camera fits the complete field without stretching it.
- The first clicked cell and its neighbors are safe. A seeded shuffle places mines on the remaining cells.
- Reveal: left-click / tap. Flag: right-click / hold 450 ms / compact Reveal/Flag toggle in the top navigation bar.
- Chord: click a revealed number when its neighboring flag count matches. Wrong flags can lose the game.
- Drag to pan; wheel or pinch to zoom; Settings → Recenter restores the view and calibrates tilt. Tilt is enabled in Settings.
- Loss plays a chain of soil, smoke, sparks, and local flashes spreading from the hit mine. Restart cancels the effects; reduced motion shows the static loss state.
- Keyboard: arrows select, Enter/Space reveals, F flags, C chords, R restarts, Home recenters. Disable in Settings.
- The timer starts on the first reveal and freezes on win/loss. Time spent in the background counts.
- Settings → Language: Follow system / 中文 / English. Chinese locales use Chinese, other locales use English.
- Settings are local. A page reload starts a new game; there is no saved game or score history.

## Develop

Requires Node 22+ and pnpm 11.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm build
pnpm preview
```

Browser checks use locally installed Chrome (configure `channel` in `playwright.config.ts` for another Chromium):

```sh
pnpm test:e2e
```

## Packages

- `packages/game-core`: pure TypeScript rules. No React, Babylon, or platform dependency.
- `packages/renderer`: Babylon engine, PBR terrain, HDR daylight, instanced vegetation, GPU wind, input, camera and smoothed tilt.
- `apps/web`: React menus and HUD, bilingual text, settings, optional sound/haptics, offline service worker.
- `apps/desktop`: thin Tauri 2 Rust host using the same built frontend.
- `apps/mobile`: Capacitor Android host using the same built frontend.

The engine owns the render loop. React updates only on interactions, settings changes, and the 200 ms HUD clock tick.
Automatic quality measures actual initial frame rate. Manual quality changes blade density, shadows, and rendering resolution.
WebGPU is preferred, WebGL is the fallback. Shader compiler WASM is bundled for offline use.
Device tilt changes only directional lighting on the field and physical frame; the camera and board do not rotate. It is opt-in, with calibration, angle normalization, dead zone, bounded sensitivity, and exponential smoothing.
Secure HTTPS/localhost and sensor support are required for browser tilt. Sensors/haptics and sound are optional.

## Offline / Cloudflare

`pnpm build` creates `dist/` with all assets and a versioned precache service worker.
After the first successful complete cache installation on HTTPS/localhost, reload and play without network.
Native apps bundle `dist/`; no external server is required. Android does not request Internet permission.

```sh
pnpm deploy
```

This publishes the static `dist/` with Cloudflare Workers Static Assets. Authenticate Wrangler with your own account.
There is no Worker API. The Cloudflare Vite plugin is unnecessary for this static-only frontend.

## Windows

Install stable Rust with the MSVC target, Visual Studio C++ Build Tools, and the Windows SDK.

```sh
pnpm desktop:dev
pnpm desktop:build
```

Produces an NSIS installer and an executable. WebView2 is required; the installer can obtain it if absent.
The installer is unsigned; production signing requires a signing certificate.

## Android

Requires JDK 21, Android SDK platform 36, and Gradle 8.14+.

```sh
pnpm mobile:sync
pnpm --dir apps/mobile android
```

Open in Android Studio and build, or set `ANDROID_HOME` then run `apps/mobile/android/gradlew assembleDebug`.
Debug APKs use a debug key. Create and protect your own release keystore before publishing.

## Validation boundary

Automated checks cover game rules, desktop and emulated touch interaction, full viewport layout, locale detection, language override persistence, and offline reload.
Native builds verify compilation/packaging. They do not establish real-device frame-rate targets, sensor calibration, GPU compatibility, or release signing.
CC0 PBR textures and HDR daylight are bundled alongside reference-guided generated textures. Revealed soil preserves the reference-guided texture and height-derived normals; each square patch uses matching shallow grooves and crops only the artwork's outer edge. The continuous background blends rotated, offset samples of the same soil interior to avoid obvious mirrored patterns. Clover, daisy, branch, beveled numbers, and a weathered metal disc mine have editable Blender sources. The branch frame and timber panels use textured relief geometry with normal maps; their lighting responds to device tilt. Counter digits and the restart token remain raster assets. Grass blades and woven red flags are procedural geometry. See `ASSETS.md` for the source of each asset.
The current visual implementation is a working baseline, not a claim of finished photorealistic production art.

See `ASSETS.md` for asset provenance.
