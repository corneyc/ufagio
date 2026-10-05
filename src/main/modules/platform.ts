import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const isWin = process.platform === "win32";
export const isMac = process.platform === "darwin";

export const home = os.homedir();

// Windows hands back 8.3 short names (C:\Users\CORNEL~1\...) in env vars
// like TEMP when the user name is long. Expand them so the UI shows real
// paths. Every scan root comes through here, so the allowed-roots check in
// safeDelete stays consistent with the paths the scan returns.
function expandShortPath(p: string): string {
  if (!isWin || !p.includes("~")) return p;
  try {
    return fs.realpathSync.native(p);
  } catch {
    return p; // folder missing or unreadable — keep what we were given
  }
}

export function winEnv(name: string, fallback: string): string {
  return expandShortPath(process.env[name] ?? fallback);
}

export const winPaths = {
  temp: () => winEnv("TEMP", path.join(home, "AppData", "Local", "Temp")),
  localAppData: () => winEnv("LOCALAPPDATA", path.join(home, "AppData", "Local")),
  roamingAppData: () => winEnv("APPDATA", path.join(home, "AppData", "Roaming")),
  windowsRoot: () => winEnv("SystemRoot", "C:\\Windows"),
};

// Absolute path prefixes that must never be deleted, no matter what a scan
// category claims. This is the last line of defence against a bad category
// definition or a path traversal in a stored id.
export const HARD_BLOCKLIST = isWin
  ? [
      winPaths.windowsRoot() + "\\System32",
      winPaths.windowsRoot() + "\\SysWOW64",
      "C:\\Program Files",
      "C:\\Program Files (x86)",
      "C:\\Users\\Default",
    ]
  : isMac
  ? ["/System", "/usr", "/bin", "/sbin", "/private/etc", "/Applications"]
  : ["/usr", "/bin", "/sbin", "/etc", "/lib", "/lib64"];

export function isUnderAny(target: string, roots: string[]): boolean {
  const resolved = path.resolve(target);
  return roots.some((root) => {
    const r = path.resolve(root);
    return resolved === r || resolved.startsWith(r + path.sep);
  });
}

export function isHardBlocked(target: string): boolean {
  return isUnderAny(target, HARD_BLOCKLIST);
}
