# Ufagio

Cross-platform (Windows + macOS) desktop utility: junk file cleanup, startup
manager, and privacy cleaner. Electron + React + TypeScript.

## Run in dev

```
npm install
npm run dev
```

## Typecheck

```
npm run typecheck
```

## Build installers

```
npm run dist:win   # NSIS installer, run from Windows
npm run dist:mac   # DMG, run from macOS
```

electron-builder cross-compiles poorly for these targets — build the Windows
installer on Windows and the macOS DMG on macOS (or in CI with matching
runners).

## Architecture

```
src/
  main/            Electron main process (Node) — the only process with
                    filesystem/registry/launchctl access
    modules/
      junk.ts       Junk file category definitions + scan
      privacy.ts     Browser cache/cookie/history category definitions + scan
      startup.ts     Windows Run-key/Startup-folder + macOS login-item/
                      LaunchAgent listing and toggling
      diskSpace.ts   Space Explorer: per-volume free/used, top installed
                      programs (Win registry / Mac .app bundles), one-level
                      folder drill-down anywhere on disk
      safetyAdvisor.ts  Heuristic safe/caution/danger classifier for
                      Space Explorer entries — name/path patterns, VM-disk
                      detection, installed-program and running-process
                      cross-reference. No LLM call; pure and synchronous.
      safeDelete.ts  Every delete is checked against the roots the last
                      scan actually returned, plus a hard-coded blocklist
                      of system paths — the renderer can never pass an
                      arbitrary path through to a real delete
      fsScan.ts      Recursive file walker (skips symlinks, depth-capped)
      platform.ts    OS path helpers + the hard blocklist
    ipc.ts           ipcMain handlers
    index.ts         BrowserWindow + app lifecycle
  preload/           contextBridge — the only surface the renderer can call
  renderer/          React UI (no Node/filesystem access at all)
  shared/types.ts    Types shared between main, preload, and renderer
```

## Safety model

- Renderer never touches the filesystem, registry, or launchctl directly —
  every action goes through `preload` -> `ipcMain` -> a main-process module.
- `safeDelete` re-derives the allowed paths from the categories the app
  itself just scanned. A compromised or buggy renderer cannot request
  deletion of a path outside that set.
- A hard blocklist (`platform.ts`) refuses to touch OS-critical directories
  (`C:\Windows\System32`, `/System`, `/usr`, etc.) regardless of what a scan
  category claims.
- Junk cleanup defaults to moving files to the OS Trash/Recycle Bin, not
  permanent delete — permanent delete is an explicit opt-in per clean.
- Privacy categories are locked in the UI while the owning browser process
  is detected as running, to avoid corrupting an open profile.
- Startup toggles never delete anything — disabling backs up the original
  registry value / login item path / LaunchAgent plist so it can be
  restored.

## Known gaps (MVP — read before shipping to real users)

- Windows registry writes only cover `HKCU` (no admin prompt needed).
  `HKLM` Run entries are not listed or editable in this build.
- macOS `~/Library/Caches` is scanned per-app-cache-folder in aggregate,
  not filtered by "safe to delete while app is open" — treat as "review
  first," which the UI already flags.
- macOS Full Disk Access is not requested/checked; unreadable paths are
  silently skipped and reported as scan errors rather than surfaced as a
  permission prompt.
- No auto-update, no code signing/notarization config — required before
  distributing outside your own machines (Gatekeeper will block an
  unsigned DMG on other Macs; SmartScreen will warn on an unsigned EXE).
- No telemetry, licensing, or update-check scaffolding — add before this
  becomes a paid product.
- Space Explorer's macOS code paths (`getMacInstalledPrograms`, `/Volumes`
  device-id dedup, `.app` bundle danger classification, VM-disk extensions
  for Parallels/VMware/Docker Desktop) were only typechecked, never run on
  a real Mac — verify before trusting results there.
- Permission-denied folders (e.g. Windows UWP package sandboxes under
  `Packages\*`) now surface a distinct error instead of looking empty —
  not yet verified this correctly maps to macOS's Full Disk Access denial
  shape, which may throw a different error code.

## Picking this up again

Last worked on: Space Explorer safety-advisor labels, Windows volume
dedup, and the permission-denied-vs-empty fix — all pushed to `origin/main`
and verified via `npm run typecheck` + live testing on Windows (PC01) only.

Next on Mac:
- Confirm the four macOS-parity fixes above actually work (installed
  programs list, `/Volumes` dedup, VM-disk flagging, uninstall copy).
- Click into a permission-denied folder (Full Disk Access not granted) and
  confirm the new error message appears instead of a blank "Empty" state —
  on Mac this likely needs an `EPERM`/`EACCES` check plus possibly a macOS-
  specific code (verify what `fsp.readdir` actually throws there).
