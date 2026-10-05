import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { SpaceRisk } from "../../shared/types";
import { isWin } from "./platform";

const execFileAsync = promisify(execFile);

export interface Classification {
  risk: SpaceRisk;
  reason: string;
  // Short, scannable badge text — "Review first" on its own told the user
  // nothing about what to actually do; this names the specific concern
  // ("In use", "Updater cache"...) so the badge itself is actionable.
  label: string;
}

// Folder/file names that are, by convention, regenerable caches or build
// output — safe to delete even though we can't prove the owning app is
// closed. If deleting one breaks something, the app just rebuilds it.
const CACHE_NAME_PATTERNS: RegExp[] = [
  /^(cache|caches|tmp|temp|logs?|log)$/i,
  /^(code cache|gpucache|cachestorage|service worker|blob_storage|shader ?cache|d3dscache)$/i,
  /^(npm-cache|yarn-cache|pnpm-store|\.pnpm-store|node-gyp|pip|electron|electron-builder|ms-playwright|cypress|nuget|\.nuget|gradle|\.gradle|\.m2)$/i,
  /^(crashdumps|crash ?reports?|diagnostics)$/i,
  /^squirreltemp$/i,
  // UWP/Store app packages: LocalCache and TempState are the sandbox's own
  // cache and scratch space (LocalState/RoamingState/Settings hold app data).
  /^(localcache|tempstate)$/i,
];

// Dev build output — safe as a folder you're looking at, but deliberately
// NOT inherited by descendants: "out" can sit inside an installed app's
// own binaries (e.g. VS Code's resources\app\out).
const BUILD_OUTPUT_PATTERN = /^(dist|build|out|\.next|\.turbo|\.parcel-cache)$/i;

const SAFE_NAME_PATTERNS: RegExp[] = [...CACHE_NAME_PATTERNS, BUILD_OUTPUT_PATTERN];

// Ancestors that stop "inside a cache/temp folder" from conferring safety:
// installed-app binaries, and cloud-synced user documents (iCloud/etc),
// where a human-named "Temp" folder can hold real files.
const NO_INHERIT_PATTERN = /^(programs?|mobile documents|cloudstorage)$/i;

const UPDATER_NAME_PATTERN = /-updater$/i;
const VM_NAME_PATTERN = /^(wsl|hyper-v|virtualbox ?vms?|parallels|vmware fusion)$/i;
const PROGRAMS_FOLDER_PATTERN = /^programs?$/i;
const PACKAGES_FOLDER_PATTERN = /^packages$/i;
const APP_BUNDLE_PATTERN = /\.app$/i;

/**
 * Pure, synchronous classification — no filesystem or process I/O here.
 * Callers gather `containsVmDisk` (from a size scan they're already
 * doing), `installedProgramNames`, and `runningProcessNames` once per
 * listing and pass them in, rather than this function re-deriving them
 * per entry.
 */
export function classifyEntry(opts: {
  name: string;
  parentDir: string;
  isDir: boolean;
  containsVmDisk: boolean;
  installedProgramNames: Set<string>;
  runningProcessNames: Set<string>;
  // Win: %LOCALAPPDATA%, Mac: ~/Library. Entries under it inherit "safe"
  // from a cache/temp ancestor; entries elsewhere never do (a user's own
  // folder named "Temp" is not disposable).
  appDataRoot?: string;
}): Classification {
  const { name, parentDir, isDir, containsVmDisk, installedProgramNames, runningProcessNames, appDataRoot } = opts;
  const lower = name.toLowerCase();
  const parentBase = path.basename(parentDir).toLowerCase();

  if (containsVmDisk) {
    return {
      risk: "danger",
      label: "Virtual disk",
      reason: "Contains a virtual-disk image — likely mounted; quit the owning app first",
    };
  }
  if (VM_NAME_PATTERN.test(name)) {
    return { risk: "danger", label: "VM storage", reason: "Virtual machine storage" };
  }
  if (isDir && PROGRAMS_FOLDER_PATTERN.test(name) && /local$/i.test(parentBase)) {
    return { risk: "danger", label: "App binaries", reason: "Installed application binaries, not cache" };
  }
  if (APP_BUNDLE_PATTERN.test(name) && (parentDir === "/Applications" || parentBase === "applications")) {
    return { risk: "danger", label: "App bundle", reason: "Installed application bundle, not cache" };
  }
  if (installedProgramNames.has(lower)) {
    return {
      risk: "danger",
      label: "Installed app",
      reason: "Matches an installed program's name — may be its install or data folder",
    };
  }

  if (isDir && SAFE_NAME_PATTERNS.some((re) => re.test(name))) {
    return { risk: "safe", label: "Cache", reason: "Regenerable cache or build output" };
  }

  // Disposable by location: anything inside a cache/temp folder under the
  // app-data region. Runs after the danger checks above, so a virtual disk
  // or installed-app match inside Temp still wins.
  if (appDataRoot) {
    const rel = path.relative(appDataRoot, parentDir);
    if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) {
      const segments = rel.split(path.sep).filter(Boolean);
      if (!segments.some((s) => NO_INHERIT_PATTERN.test(s))) {
        const hit = segments.find((s) => CACHE_NAME_PATTERNS.some((re) => re.test(s)));
        if (hit) {
          return {
            risk: "safe",
            label: /^(tmp|temp|tempstate)$/i.test(hit) ? "In Temp" : "In cache",
            reason: `Inside "${hit}" — regenerable; close the owning app first if it's running`,
          };
        }
      }
    }
  }

  if (runningProcessNames.has(lower)) {
    return {
      risk: "caution",
      label: "In use",
      reason: "A running process shares this name — close it before deleting",
    };
  }
  if (UPDATER_NAME_PATTERN.test(name)) {
    return {
      risk: "caution",
      label: "Updater cache",
      reason: "Auto-updater cache — will re-download on next update",
    };
  }
  if (isDir && PACKAGES_FOLDER_PATTERN.test(name)) {
    return {
      risk: "caution",
      label: "App storage",
      reason: "Per-app sandboxed storage — open each app to see what's using the space",
    };
  }

  return isDir
    ? { risk: "caution", label: "Unknown folder", reason: "Unclassified folder — review contents before deleting" }
    : { risk: "caution", label: "Unknown file", reason: "Unclassified file — review before deleting" };
}

// Best-effort "is something by this name currently running" check, used to
// flag app-named folders rather than to gate deletion outright — a miss
// here just means a less helpful reason string, not a wrong one.
export async function getRunningProcessNames(): Promise<Set<string>> {
  try {
    if (isWin) {
      const { stdout } = await execFileAsync("tasklist", ["/fo", "csv", "/nh"], {
        maxBuffer: 1024 * 1024 * 8,
      });
      const names = new Set<string>();
      for (const line of stdout.split(/\r?\n/)) {
        const m = line.match(/^"([^"]+)"/);
        if (m) names.add(m[1].replace(/\.exe$/i, "").toLowerCase());
      }
      return names;
    }
    const { stdout } = await execFileAsync("ps", ["-A", "-o", "comm="], {
      maxBuffer: 1024 * 1024 * 8,
    });
    const names = new Set<string>();
    for (const line of stdout.split(/\r?\n/)) {
      const base = path.basename(line.trim());
      if (base) names.add(base.toLowerCase());
    }
    return names;
  } catch {
    return new Set();
  }
}
