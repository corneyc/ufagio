import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { InstalledProgram, SpaceChild, SpaceListing, VolumeInfo } from "../../shared/types";
import { home, isMac, isWin, winPaths } from "./platform";
import { sumSize, walkFiles } from "./fsScan";
import { classifyEntry, getRunningProcessNames } from "./safetyAdvisor";

const execFileAsync = promisify(execFile);

// Virtual-disk formats worth flagging wherever they turn up: Hyper-V/WSL
// (.vhd/.vhdx) on Windows, Parallels/VMware/UTM/Docker Desktop
// (.vmdk/.qcow2/.vdi) on Mac.
const VM_DISK_EXTENSIONS = /\.(vhdx?|vmdk|qcow2|vdi)$/i;

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
  if (isMac) {
    // Boot volume plus anything else mounted under /Volumes (external
    // drives, disk images, other APFS volumes). Modern macOS sometimes
    // mounts the boot volume at both "/" and its own /Volumes entry, so
    // dedupe by device id rather than by path.
    const mounts = ["/"];
    try {
      const extra = await fsp.readdir("/Volumes");
      for (const v of extra) mounts.push(path.join("/Volumes", v));
    } catch {
      // /Volumes unreadable — root alone is still reported below
    }
    const seenDevices = new Set<number>();
    const results: VolumeInfo[] = [];
    for (const m of mounts) {
      let dev: number;
      try {
        dev = (await fsp.stat(m)).dev;
      } catch {
        continue; // broken symlink or a volume that just unmounted
      }
      if (seenDevices.has(dev)) continue;
      seenDevices.add(dev);
      const v = await statVolume(m);
      if (v) results.push(v);
    }
    return results;
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

async function getWindowsInstalledPrograms(limit: number): Promise<InstalledProgram[]> {
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

// macOS has no installed-programs registry — a "program" is a .app bundle
// under /Applications or ~/Applications, and its size on disk already
// includes everything it carries (unlike Windows, there's no separate
// EstimatedSize to read; this walks each bundle directly).
async function getMacInstalledPrograms(limit: number): Promise<InstalledProgram[]> {
  const roots = ["/Applications", path.join(home, "Applications")];
  const apps: InstalledProgram[] = [];
  for (const root of roots) {
    let entries: string[];
    try {
      entries = await fsp.readdir(root);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.endsWith(".app")) continue;
      try {
        const sizeBytes = sumSize(await walkFiles(path.join(root, entry)));
        apps.push({ name: entry.replace(/\.app$/, ""), sizeBytes });
      } catch {
        // unreadable bundle (permissions) — skip it, don't fail the listing
      }
    }
  }
  return apps.sort((a, b) => b.sizeBytes - a.sizeBytes).slice(0, limit);
}

export async function getTopInstalledPrograms(limit = 20): Promise<InstalledProgram[]> {
  if (isWin) return getWindowsInstalledPrograms(limit);
  if (isMac) return getMacInstalledPrograms(limit);
  return [];
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
          // Reuses the walk we already did for sizing — no extra I/O to spot
          // a mounted virtual-disk image buried a couple of levels down
          // (this is exactly how the PC01 audit found Claude's
          // local-agent-mode VM; Docker Desktop's VM disk on Mac is the
          // same shape, just .qcow2/.vmdk instead of .vhdx).
          const containsVmDisk = entries.some((e) => VM_DISK_EXTENSIONS.test(e.path));
          const { risk, reason } = classifyEntry({
            name,
            parentDir: dirPath,
            isDir: true,
            containsVmDisk,
            installedProgramNames,
            runningProcessNames,
          });
          return { name, path: full, isDir: true, sizeBytes, risk, reason };
        }
        const { risk, reason } = classifyEntry({
          name,
          parentDir: dirPath,
          isDir: false,
          // A standalone .vhdx/.vmdk/etc at this level is itself the virtual
          // disk — not just a folder that happens to contain one.
          containsVmDisk: VM_DISK_EXTENSIONS.test(name),
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
