import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PrivacyCategory, PrivacyScanResult } from "../../shared/types";
import { home, isMac, isWin, winPaths } from "./platform";
import { expandGlobRoots, sumSize, walkManyRoots } from "./fsScan";

const execFileAsync = promisify(execFile);

interface PrivacyDef {
  id: string;
  label: string;
  browser: string;
  processNames: string[]; // process names to check (any match => "running")
  roots: string[];
}

function windowsDefs(): PrivacyDef[] {
  const localAppData = winPaths.localAppData();
  return [
    {
      id: "priv-win-chrome",
      label: "Chrome cache, cookies & history",
      browser: "Chrome",
      processNames: ["chrome.exe"],
      roots: [
        path.join(localAppData, "Google", "Chrome", "User Data", "Default", "Cache"),
        path.join(localAppData, "Google", "Chrome", "User Data", "Default", "Cookies"),
        path.join(localAppData, "Google", "Chrome", "User Data", "Default", "History"),
      ],
    },
    {
      id: "priv-win-edge",
      label: "Edge cache, cookies & history",
      browser: "Edge",
      processNames: ["msedge.exe"],
      roots: [
        path.join(localAppData, "Microsoft", "Edge", "User Data", "Default", "Cache"),
        path.join(localAppData, "Microsoft", "Edge", "User Data", "Default", "Cookies"),
        path.join(localAppData, "Microsoft", "Edge", "User Data", "Default", "History"),
      ],
    },
    {
      id: "priv-win-firefox",
      label: "Firefox cache & cookies",
      browser: "Firefox",
      processNames: ["firefox.exe"],
      roots: [
        path.join(localAppData, "Mozilla", "Firefox", "Profiles", "*", "cache2"),
        path.join(winPaths.roamingAppData(), "Mozilla", "Firefox", "Profiles", "*", "cookies.sqlite"),
      ],
    },
    {
      id: "priv-win-run-mru",
      label: "Windows Explorer recent files",
      browser: "Windows",
      processNames: [],
      roots: [path.join(winPaths.roamingAppData(), "Microsoft", "Windows", "Recent")],
    },
  ];
}

function macDefs(): PrivacyDef[] {
  return [
    {
      id: "priv-mac-chrome",
      label: "Chrome cache & cookies",
      browser: "Chrome",
      processNames: ["Google Chrome"],
      roots: [
        path.join(home, "Library", "Caches", "Google", "Chrome"),
        path.join(home, "Library", "Application Support", "Google", "Chrome", "Default", "Cookies"),
      ],
    },
    {
      id: "priv-mac-safari",
      label: "Safari cache & history",
      browser: "Safari",
      processNames: ["Safari"],
      roots: [
        path.join(home, "Library", "Caches", "com.apple.Safari"),
        path.join(home, "Library", "Safari", "History.db"),
      ],
    },
    {
      id: "priv-mac-firefox",
      label: "Firefox cache & cookies",
      browser: "Firefox",
      processNames: ["firefox"],
      roots: [path.join(home, "Library", "Caches", "Firefox", "Profiles", "*", "cache2")],
    },
  ];
}

function getDefs(): PrivacyDef[] {
  return isWin ? windowsDefs() : isMac ? macDefs() : [];
}

async function isProcessRunning(names: string[]): Promise<boolean> {
  if (names.length === 0) return false;
  try {
    if (isWin) {
      const { stdout } = await execFileAsync("tasklist", []);
      return names.some((n) => stdout.toLowerCase().includes(n.toLowerCase()));
    }
    const { stdout } = await execFileAsync("ps", ["-A", "-o", "comm="]);
    return names.some((n) => stdout.toLowerCase().includes(n.toLowerCase()));
  } catch {
    return false; // if we can't tell, don't block the scan on it
  }
}

export const lastPrivacyRootsByCategory = new Map<string, string[]>();

export async function scanPrivacy(): Promise<PrivacyScanResult> {
  const defs = getDefs();
  const categories: PrivacyCategory[] = [];

  for (const def of defs) {
    const expandedRoots: string[] = [];
    for (const root of def.roots) {
      expandedRoots.push(...(await expandGlobRoots(root)));
    }
    lastPrivacyRootsByCategory.set(def.id, expandedRoots);

    const [{ entries, error }, running] = await Promise.all([
      walkManyRoots(expandedRoots),
      isProcessRunning(def.processNames),
    ]);

    categories.push({
      id: def.id,
      label: def.label,
      browser: def.browser,
      processRunning: running,
      roots: expandedRoots,
      entries,
      totalSize: sumSize(entries),
      error,
    });
  }

  return { categories, scannedAt: Date.now() };
}

export function allowedRootsForPrivacyDelete(): string[] {
  return [...lastPrivacyRootsByCategory.values()].flat();
}
