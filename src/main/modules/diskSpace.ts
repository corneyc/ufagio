import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { InstalledProgram, SpaceChild, SpaceListing, VolumeInfo } from "../../shared/types";
import { home, isWin, winPaths } from "./platform";
import { sumSize, walkFiles } from "./fsScan";
import { classifyEntry, getRunningProcessNames } from "./safetyAdvisor";

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Disk volumes — free/used per mounted drive
// ---------------------------------------------------------------------------

async function statVolume(mount: string): Promise<VolumeInfo | null> {
  try {
    const s = await fsp.statfs(mount);
    const totalBytes = s.blocks * s.bsize;
    const freeBytes = s.bfree * s.bsize;
    return {
      mount,
      totalBytes,
      freeBytes,
      usedBytes: totalBytes - freeBytes,
      pctFree: totalBytes > 0 ? Math.round((freeBytes / totalBytes) * 1000) / 10 : 0,
    };
  } catch {
    return null;
  }
}

export async function getVolumes(): Promise<VolumeInfo[]> {
  if (isWin) {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const candidates = letters.map((l) => `${l}:\\`).filter((p) => fs.existsSync(p));
    const results = await Promise.all(candidates.map(statVolume));
    return results.filter((v): v is VolumeInfo => v !== null);
  }
  const root = await statVolume("/");
  return root ? [root] : [];
}

// ---------------------------------------------------------------------------
// Installed programs (Windows only) — reads the same Uninstall registry
// keys Control Panel / Settings > Apps reads EstimatedSize from. This is
// read-only: Ufagio never drives an uninstaller itself.
// ---------------------------------------------------------------------------

const UNINSTALL_ROOTS = [
  "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
  "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
  "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
];

async function queryUninstallRoot(rootKey: string): Promise<InstalledProgram[]> {
  try {
    const { stdout } = await execFileAsync("reg", ["query", rootKey, "/s"], {
      maxBuffer: 1024 * 1024 * 32,
    });
    const programs: InstalledProgram[] = [];
    for (const block of stdout.split(/\r?\n(?=HKEY_)/)) {
      const nameMatch = block.match(/^\s*DisplayName\s+REG_SZ\s+(.+?)\r?$/m);
      const sizeMatch = block.match(/^\s*EstimatedSize\s+REG_DWORD\s+0x([0-9a-fA-F]+)/m);
      if (nameMatch && sizeMatch) {
        programs.push({
          name: nameMatch[1].trim(),
          sizeBytes: parseInt(sizeMatch[1], 16) * 1024, // EstimatedSize is stored in KB
        });
      }
    }
    return programs;
  } catch {
    return [];
  }
}

export async function getTopInstalledPrograms(limit = 20): Promise<InstalledProgram[]> {
  if (!isWin) return [];
  const all = (await Promise.all(UNINSTALL_ROOTS.map(queryUninstallRoot))).flat();
  // HKLM/WOW6432Node/HKCU can list the same product more than once —
  // keep the largest reported size per display name.
  const byName = new Map<string, InstalledProgram>();
  for (const p of all) {
    const existing = byName.get(p.name);
    if (!existing || p.sizeBytes > existing.sizeBytes) byName.set(p.name, p);
  }
  return [...byName.values()].sort((a, b) => b.sizeBytes - a.sizeBytes).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Folder drill-down — "what's actually using the space". Unlike junk.ts's
// fixed categories, this can reach anywhere on disk, so every delete stays
// gated behind safeDelete's hard blocklist, and only paths this module has
// itself just listed are ever eligible for deletion.
// ---------------------------------------------------------------------------

export function defaultSpaceRoot(): string {
  if (isWin) return winPaths.localAppData();
  return path.join(home, "Library");
}

// Every path handed back by listSpaceChildren, across every drill-down
// level visited this session — mirrors junk.ts's lastScanRootsByCategory.
const knownSpacePaths = new Set<string>();

export function allowedRootsForSpaceDelete(): string[] {
  return [...knownSpacePaths];
}

export async function listSpaceChildren(dirPath: string): Promise<SpaceListing> {
  let names: string[] = [];
  try {
    names = await fsp.readdir(dirPath);
  } catch {
    return { parent: dirPath, children: [], scannedAt: Date.now() };
  }

  // Gathered once per listing, not per entry — reg query and tasklist are
  // each a single process spawn regardless of how many children we classify.
  const [installedPrograms, runningProcessNames] = await Promise.all([
    getTopInstalledPrograms(200),
    getRunningProcessNames(),
  ]);
  const installedProgramNames = new Set(installedPrograms.map((p) => p.name.toLowerCase()));

  const settled = await Promise.all(
    names.map(async (name): Promise<SpaceChild | null> => {
      const full = path.join(dirPath, name);
      try {
        const stat = await fsp.lstat(full);
        if (stat.isSymbolicLink()) return null; // never follow, never list
        if (stat.isDirectory()) {
          const entries = await walkFiles(full);
          const sizeBytes = sumSize(entries);
          // Reuses the walk we already did for sizing — no extra I/O to
          // spot a mounted .vhdx buried a couple of levels down (this is
          // exactly how the PC01 audit found Claude's local-agent-mode VM).
          const containsVhd = entries.some((e) => /\.vhdx?$/i.test(e.path));
          const { risk, reason } = classifyEntry({
            name,
            parentDir: dirPath,
            isDir: true,
            containsVhd,
            installedProgramNames,
            runningProcessNames,
          });
          return { name, path: full, isDir: true, sizeBytes, risk, reason };
        }
        const { risk, reason } = classifyEntry({
          name,
          parentDir: dirPath,
          isDir: false,
          containsVhd: false,
          installedProgramNames,
          runningProcessNames,
        });
        return { name, path: full, isDir: false, sizeBytes: stat.size, risk, reason };
      } catch (e) {
        return {
          name,
          path: full,
          isDir: false,
          sizeBytes: 0,
          risk: "caution",
          reason: "Could not be read",
          error: (e as Error).message,
        };
      }
    })
  );

  const children = settled.filter((c): c is SpaceChild => c !== null);
  children.sort((a, b) => b.sizeBytes - a.sizeBytes);
  for (const c of children) knownSpacePaths.add(c.path);

  return { parent: dirPath, children, scannedAt: Date.now() };
}
