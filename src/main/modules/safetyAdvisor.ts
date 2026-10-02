import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { SpaceRisk } from "../../shared/types";
import { isWin } from "./platform";

const execFileAsync = promisify(execFile);

export interface Classification {
  risk: SpaceRisk;
  reason: string;
}

// Folder/file names that are, by convention, regenerable caches or build
// output — safe to delete even though we can't prove the owning app is
// closed. If deleting one breaks something, the app just rebuilds it.
const SAFE_NAME_PATTERNS: RegExp[] = [
  /^(cache|caches|tmp|temp|logs?|log)$/i,
  /^(code cache|gpucache|cachestorage|service worker|blob_storage|shader ?cache|d3dscache)$/i,
  /^(npm-cache|yarn-cache|pnpm-store|\.pnpm-store|node-gyp|pip|electron|electron-builder|ms-playwright|cypress|nuget|\.nuget|gradle|\.gradle|\.m2)$/i,
  /^(crashdumps|crash ?reports?|diagnostics)$/i,
  /^squirreltemp$/i,
  /^(dist|build|out|\.next|\.turbo|\.parcel-cache)$/i,
];

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
}): Classification {
  const { name, parentDir, isDir, containsVmDisk, installedProgramNames, runningProcessNames } = opts;
  const lower = name.toLowerCase();
  const parentBase = path.basename(parentDir).toLowerCase();

  if (containsVmDisk) {
    return {
      risk: "danger",
      reason: "Contains a virtual-disk image — likely mounted; quit the owning app first",
    };
  }
  if (VM_NAME_PATTERN.test(name)) {
    return { risk: "danger", reason: "Virtual machine storage" };
  }
  if (isDir && PROGRAMS_FOLDER_PATTERN.test(name) && /local$/i.test(parentBase)) {
    return { risk: "danger", reason: "Installed application binaries, not cache" };
  }
  if (APP_BUNDLE_PATTERN.test(name) && (parentDir === "/Applications" || parentBase === "applications")) {
    return { risk: "danger", reason: "Installed application bundle, not cache" };
  }
  if (installedProgramNames.has(lower)) {
    return {
      risk: "danger",
      reason: "Matches an installed program's name — may be its install or data folder",
    };
  }

  if (isDir && SAFE_NAME_PATTERNS.some((re) => re.test(name))) {
    return { risk: "safe", reason: "Regenerable cache or build output" };
  }

  if (runningProcessNames.has(lower)) {
    return { risk: "caution", reason: "A running process shares this name — close it before deleting" };
  }
  if (UPDATER_NAME_PATTERN.test(name)) {
    return { risk: "caution", reason: "Auto-updater cache — will re-download on next update" };
  }
  if (isDir && PACKAGES_FOLDER_PATTERN.test(name)) {
    return {
      risk: "caution",
      reason: "Per-app sandboxed storage — open each app to see what's using the space",
    };
  }

  return isDir
    ? { risk: "caution", reason: "Unclassified folder — review contents before deleting" }
    : { risk: "caution", reason: "Unclassified file — review before deleting" };
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
