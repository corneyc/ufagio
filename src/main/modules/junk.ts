import path from "node:path";
import { JunkCategory, JunkScanResult } from "../../shared/types";
import { home, isMac, isWin, winPaths } from "./platform";
import { expandGlobRoots, sumSize, walkManyRoots } from "./fsScan";

interface CategoryDef {
  id: string;
  label: string;
  risk: "safe" | "caution";
  roots: string[]; // may contain a single "*" glob segment
}

function windowsCategories(): CategoryDef[] {
  const localAppData = winPaths.localAppData();
  const roamingAppData = winPaths.roamingAppData();
  const winRoot = winPaths.windowsRoot();
  return [
    {
      id: "win-user-temp",
      label: "User temp files",
      risk: "safe",
      roots: [winPaths.temp()],
    },
    {
      id: "win-system-temp",
      label: "System temp files",
      risk: "safe",
      roots: [path.join(winRoot, "Temp")],
    },
    {
      id: "win-explorer-thumbcache",
      label: "Explorer thumbnail cache",
      risk: "safe",
      roots: [path.join(localAppData, "Microsoft", "Windows", "Explorer")],
    },
    {
      id: "win-update-cache",
      label: "Windows Update download cache",
      risk: "caution",
      roots: [path.join(winRoot, "SoftwareDistribution", "Download")],
    },
    {
      id: "win-chrome-cache",
      label: "Chrome browser cache",
      risk: "safe",
      roots: [path.join(localAppData, "Google", "Chrome", "User Data", "Default", "Cache")],
    },
    {
      id: "win-edge-cache",
      label: "Edge browser cache",
      risk: "safe",
      roots: [path.join(localAppData, "Microsoft", "Edge", "User Data", "Default", "Cache")],
    },
    {
      id: "win-firefox-cache",
      label: "Firefox browser cache",
      risk: "safe",
      roots: [path.join(localAppData, "Mozilla", "Firefox", "Profiles", "*", "cache2")],
    },
    {
      id: "win-prefetch",
      label: "Prefetch files",
      risk: "caution",
      roots: [path.join(winRoot, "Prefetch")],
    },
    {
      id: "win-recent",
      label: "Recent items shortcuts",
      risk: "safe",
      roots: [path.join(roamingAppData, "Microsoft", "Windows", "Recent")],
    },
  ];
}

function macCategories(): CategoryDef[] {
  return [
    {
      id: "mac-tmp",
      label: "System temp (/tmp)",
      risk: "safe",
      roots: ["/tmp"],
    },
    {
      id: "mac-user-logs",
      label: "User log files",
      risk: "safe",
      roots: [path.join(home, "Library", "Logs")],
    },
    {
      id: "mac-app-caches",
      label: "Application caches",
      risk: "caution",
      roots: [path.join(home, "Library", "Caches")],
    },
    {
      id: "mac-chrome-cache",
      label: "Chrome browser cache",
      risk: "safe",
      roots: [path.join(home, "Library", "Caches", "Google", "Chrome")],
    },
    {
      id: "mac-safari-cache",
      label: "Safari browser cache",
      risk: "safe",
      roots: [path.join(home, "Library", "Caches", "com.apple.Safari")],
    },
    {
      id: "mac-xcode-derived-data",
      label: "Xcode derived data",
      risk: "safe",
      roots: [path.join(home, "Library", "Developer", "Xcode", "DerivedData")],
    },
    {
      id: "mac-trash",
      label: "Trash",
      risk: "caution",
      roots: [path.join(home, ".Trash")],
    },
  ];
}

function linuxCategories(): CategoryDef[] {
  return [
    { id: "linux-tmp", label: "System temp (/tmp)", risk: "safe", roots: ["/tmp"] },
    {
      id: "linux-user-cache",
      label: "User cache (~/.cache)",
      risk: "caution",
      roots: [path.join(home, ".cache")],
    },
  ];
}

function getCategoryDefs(): CategoryDef[] {
  if (isWin) return windowsCategories();
  if (isMac) return macCategories();
  return linuxCategories();
}

// Remembers exactly which roots were scanned last, per category id, so
// deleteJunk can verify every path it's asked to remove actually came from
// a real scan rather than trusting whatever the renderer sends.
export const lastScanRootsByCategory = new Map<string, string[]>();

export async function scanJunk(): Promise<JunkScanResult> {
  const defs = getCategoryDefs();
  const categories: JunkCategory[] = [];

  for (const def of defs) {
    const expandedRoots: string[] = [];
    for (const root of def.roots) {
      expandedRoots.push(...(await expandGlobRoots(root)));
    }
    lastScanRootsByCategory.set(def.id, expandedRoots);

    const { entries, error } = await walkManyRoots(expandedRoots);
    categories.push({
      id: def.id,
      label: def.label,
      risk: def.risk,
      roots: expandedRoots,
      entries,
      totalSize: sumSize(entries),
      error,
    });
  }

  return { categories, scannedAt: Date.now() };
}

export function allowedRootsForJunkDelete(): string[] {
  return [...lastScanRootsByCategory.values()].flat();
}
