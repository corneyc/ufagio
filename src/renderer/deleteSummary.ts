import { DeleteResultItem } from "../shared/types";

export interface DeleteSummary {
  tone: "success" | "warning" | "danger";
  text: string;
  // Real failures first, then locked-file skips, so genuine problems lead.
  details: DeleteResultItem[];
}

/**
 * Splits delete results into done / in use (locked by a running app — an
 * expected skip) / genuinely failed, so a normal skip never reads as an error.
 */
export function summarizeDelete(res: DeleteResultItem[], noun: string, verb: string): DeleteSummary {
  const ok = res.filter((r) => r.ok).length;
  const inUse = res.filter((r) => !r.ok && r.inUse);
  const failed = res.filter((r) => !r.ok && !r.inUse);
  const parts = [`${verb} ${ok} ${noun}(s)`];
  if (inUse.length) parts.push(`${inUse.length} in use, skipped`);
  if (failed.length) parts.push(`${failed.length} failed`);
  return {
    tone: failed.length ? "danger" : inUse.length ? "warning" : "success",
    text: `${parts.join(" · ")}.`,
    details: [
      ...failed,
      ...inUse.map((r) => ({ ...r, error: "in use — close the app and rescan" })),
    ],
  };
}
