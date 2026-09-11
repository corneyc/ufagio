# Contributing to Ufagio

Ufagio is a cross-platform junk cleaner, startup manager, and privacy cleaner built with Electron, React, and TypeScript.

## Dev setup

```bash
npm install
npm run dev
```

This runs the Vite renderer dev server and the TypeScript main-process watcher together, then launches Electron once both are ready.

## Typecheck and build

```bash
npm run typecheck
npm run build
```

`typecheck` runs `tsc --noEmit` against both the main process (`tsconfig.main.json`) and the renderer (`tsconfig.renderer.json`). CI runs this on every push and PR to `main`.

## Packaging installers locally

```bash
npm run dist:win   # NSIS installer on Windows
npm run dist:mac   # DMG on macOS
```

Tagged pushes (`vX.Y.Z`) trigger the release workflow, which builds and publishes installers to GitHub Releases via `electron-builder --publish always`.

## Code conventions

- Inline styles over Tailwind or any CSS framework — see `src/renderer/theme.ts` for the shared color/radius/shadow tokens and `src/renderer/components/ui.tsx` for the shared component library.
- MVP-first. Don't add abstraction or configurability for scale this app doesn't have yet.
- Process split: `src/main` (Node/Electron, no DOM), `src/preload` (contextBridge only, no app logic), `src/renderer` (React, no direct Node/fs access), `src/shared` (types used by more than one process).

## Safety model

Ufagio deletes files, so the delete path is deliberately paranoid. Two things matter if you're touching `src/main/modules/junk.ts` or `src/main/modules/safeDelete.ts`:

1. **Scans are scoped to known OS junk locations only** — temp dirs, browser caches, thumbnail caches, prefetch, recent-items. The scanner never touches user document folders (Downloads, Desktop, Documents, etc.), and it shouldn't ever be extended to.
2. **Every delete is re-verified server-side against the roots that produced it.** `junk.ts` records which root paths were used for the most recent scan of each category (`lastScanRootsByCategory`); `safeDelete.ts` calls `allowedRootsForJunkDelete()` and rejects any delete request for a path outside those roots, even if the renderer asks for it. Don't bypass this check to "simplify" a PR — it's the only thing standing between a scanner bug and a user's real files.

If you're adding a new junk category, add its root(s) to the allowlist in the same PR that adds the scan logic. Don't rely on the renderer to only ever ask for safe paths.

## Reporting bugs

Open a GitHub issue with your OS/version, what you expected, and what happened. If it's a deletion-related bug, please include exactly which category/paths were involved — this codebase treats data-loss reports as highest priority.

## License

MIT. By contributing, you agree your contributions are licensed under the same terms.
