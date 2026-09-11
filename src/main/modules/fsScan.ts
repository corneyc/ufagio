import fs from "node:fs/promises";
import path from "node:path";
import { JunkEntry } from "../../shared/types";

const MAX_DEPTH = 12;
const MAX_ENTRIES_PER_ROOT = 20000; // guard against pathological caches

/**
 * Recursively walks a root directory and returns every file found, with size
 * and mtime. Silently skips anything it can't read (permission errors are
 * expected — e.g. macOS Full Disk Access, or a file that vanished mid-scan)
 * and never follows symlinks, so a scan can't wander outside the root.
 */
export async function walkFiles(root: string): Promise<JunkEntry[]> {
  const out: JunkEntry[] = [];
  let stat;
  try {
    stat = await fs.lstat(root);
  } catch {
    return out;
  }
  if (!stat.isDirectory()) {
    if (stat.isFile()) out.push({ path: root, size: stat.size, mtimeMs: stat.mtimeMs });
    return out;
  }

  async function walk(dir: string, depth: number) {
    if (out.length >= MAX_ENTRIES_PER_ROOT || depth > MAX_DEPTH) return;
    let items: string[];
    try {
      items = await fs.readdir(dir);
    } catch {
      return;
    }
    for (const item of items) {
      if (out.length >= MAX_ENTRIES_PER_ROOT) return;
      const full = path.join(dir, item);
      let s;
      try {
        s = await fs.lstat(full);
      } catch {
        continue;
      }
      if (s.isSymbolicLink()) continue;
      if (s.isDirectory()) {
        await walk(full, depth + 1);
      } else if (s.isFile()) {
        out.push({ path: full, size: s.size, mtimeMs: s.mtimeMs });
      }
    }
  }

  await walk(root, 0);
  return out;
}

export async function walkManyRoots(roots: string[]): Promise<{ entries: JunkEntry[]; error?: string }> {
  const entries: JunkEntry[] = [];
  const errors: string[] = [];
  for (const root of roots) {
    try {
      entries.push(...(await walkFiles(root)));
    } catch (e) {
      errors.push(`${root}: ${(e as Error).message}`);
    }
  }
  return { entries, error: errors.length ? errors.join("; ") : undefined };
}

export function sumSize(entries: JunkEntry[]): number {
  return entries.reduce((acc, e) => acc + e.size, 0);
}

/** Expands roots that contain a single "*" glob segment (e.g. profile dirs). */
export async function expandGlobRoots(pattern: string): Promise<string[]> {
  const starIndex = pattern.indexOf("*");
  if (starIndex === -1) return [pattern];
  const before = pattern.slice(0, starIndex);
  const parentDir = before.endsWith(path.sep) ? before.slice(0, -1) : path.dirname(before);
  const restStart = before.length;
  const suffix = pattern.slice(restStart).split(path.sep).slice(1).join(path.sep);
  try {
    const items = await fs.readdir(parentDir);
    return items.map((item) => path.join(parentDir, item, suffix));
  } catch {
    return [];
  }
}
