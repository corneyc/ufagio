import fs from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { shell } from "electron";

import { DeleteResultItem } from "../../shared/types";
import { isHardBlocked, isUnderAny } from "./platform";

/**
 * Deletes paths, but ONLY if each path sits under one of `allowedRoots` —
 * the roots that were actually returned by the last scan — and is not
 * inside the hard blocklist. The renderer can never hand us an arbitrary
 * path and have it honoured; every delete is checked server-side (main
 * process) against what we ourselves scanned.
 */
export async function safeDelete(
  paths: string[],
  allowedRoots: string[],
  permanent: boolean
): Promise<DeleteResultItem[]> {
  const results: DeleteResultItem[] = [];

  for (const p of paths) {
    if (isHardBlocked(p)) {
      results.push({ path: p, ok: false, error: "blocked: protected system path" });
      continue;
    }
    if (!isUnderAny(p, allowedRoots)) {
      results.push({ path: p, ok: false, error: "blocked: path was not part of the last scan" });
      continue;
    }
    if (!permanent) {
      try {
        await fs.access(p, fsConstants.W_OK);
      } catch {
        results.push({ path: p, ok: false, error: "blocked: no delete permission (admin required)" });
        continue;
      }
    }
    try {
      if (permanent) {
        await fs.rm(p, { force: true });
      } else {
        await shell.trashItem(p);
      }
      results.push({ path: p, ok: true });
    } catch (e) {
      results.push({ path: p, ok: false, error: (e as Error).message });
    }
  }

  return results;
}
