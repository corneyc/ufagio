import fs from "node:fs/promises";
import fsync from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { app } from "electron";
import { StartupItem } from "../../shared/types";
import { home, isMac, isWin, winPaths } from "./platform";

const execFileAsync = promisify(execFile);

function backupFilePath(): string {
  const dir = app.getPath("userData");
  if (!fsync.existsSync(dir)) fsync.mkdirSync(dir, { recursive: true });
  return path.join(dir, "startup-backups.json");
}

function readBackups(): Record<string, { name: string; command: string }> {
  try {
    return JSON.parse(fsync.readFileSync(backupFilePath(), "utf8"));
  } catch {
    return {};
  }
}

function writeBackups(data: Record<string, { name: string; command: string }>) {
  fsync.writeFileSync(backupFilePath(), JSON.stringify(data, null, 2), "utf8");
}

function disabledStartupFolderDir(): string {
  const dir = path.join(app.getPath("userData"), "disabled-startup-items");
  if (!fsync.existsSync(dir)) fsync.mkdirSync(dir, { recursive: true });
  return dir;
}

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------

const RUN_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";

async function listWindowsRegistryRunItems(): Promise<StartupItem[]> {
  try {
    const { stdout } = await execFileAsync("reg", ["query", RUN_KEY]);
    const items: StartupItem[] = [];
    for (const line of stdout.split(/\r?\n/)) {
      const m = line.match(/^\s{4}(\S+)\s+(REG_\S+)\s+(.*)$/);
      if (!m) continue;
      const [, name, , command] = m;
      items.push({
        id: `reg:${name}`,
        name,
        command,
        source: "registry-run",
        enabled: true,
        editable: true,
      });
    }
    return items;
  } catch {
    return [];
  }
}

async function listWindowsStartupFolderItems(): Promise<StartupItem[]> {
  const folder = path.join(winPaths.roamingAppData(), "Microsoft", "Windows", "Start Menu", "Programs", "Startup");
  const items: StartupItem[] = [];
  try {
    const entries = await fs.readdir(folder);
    for (const entry of entries) {
      items.push({
        id: `folder:${entry}`,
        name: entry.replace(/\.(lnk|exe|bat|cmd)$/i, ""),
        command: path.join(folder, entry),
        source: "startup-folder",
        enabled: true,
        editable: true,
      });
    }
  } catch {
    // folder missing or unreadable — not fatal
  }
  // Anything we previously disabled and parked in our own folder.
  try {
    const disabledDir = disabledStartupFolderDir();
    const entries = await fs.readdir(disabledDir);
    for (const entry of entries) {
      items.push({
        id: `folder:${entry}`,
        name: entry.replace(/\.(lnk|exe|bat|cmd)$/i, ""),
        command: path.join(disabledDir, entry),
        source: "startup-folder",
        enabled: false,
        editable: true,
      });
    }
  } catch {
    // ignore
  }
  return items;
}

async function toggleWindowsRegistryItem(name: string, enabled: boolean): Promise<{ ok: boolean; error?: string }> {
  const backups = readBackups();
  const id = `reg:${name}`;
  try {
    if (!enabled) {
      const { stdout } = await execFileAsync("reg", ["query", RUN_KEY, "/v", name]);
      const m = stdout.match(/REG_\S+\s+(.*)$/m);
      const command = m ? m[1].trim() : "";
      backups[id] = { name, command };
      writeBackups(backups);
      await execFileAsync("reg", ["delete", RUN_KEY, "/v", name, "/f"]);
    } else {
      const backup = backups[id];
      if (!backup) return { ok: false, error: "no backup found to restore this entry" };
      await execFileAsync("reg", ["add", RUN_KEY, "/v", backup.name, "/t", "REG_SZ", "/d", backup.command, "/f"]);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function toggleWindowsStartupFolderItem(fileName: string, enabled: boolean): Promise<{ ok: boolean; error?: string }> {
  const activeFolder = path.join(winPaths.roamingAppData(), "Microsoft", "Windows", "Start Menu", "Programs", "Startup");
  const disabledDir = disabledStartupFolderDir();
  try {
    if (!enabled) {
      await fs.rename(path.join(activeFolder, fileName), path.join(disabledDir, fileName));
    } else {
      await fs.rename(path.join(disabledDir, fileName), path.join(activeFolder, fileName));
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// macOS
// ---------------------------------------------------------------------------

async function listMacLoginItems(): Promise<StartupItem[]> {
  try {
    const { stdout } = await execFileAsync("osascript", [
      "-e",
      'tell application "System Events" to get the name of every login item',
    ]);
    const names = stdout
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return names.map((name) => ({
      id: `login:${name}`,
      name,
      command: "Login Item",
      source: "login-item" as const,
      enabled: true,
      editable: true,
    }));
  } catch {
    return [];
  }
}

async function listMacLaunchAgents(): Promise<StartupItem[]> {
  const dirs = [path.join(home, "Library", "LaunchAgents")];
  const items: StartupItem[] = [];
  for (const dir of dirs) {
    try {
      const entries = await fs.readdir(dir);
      for (const entry of entries) {
        const disabled = entry.endsWith(".disabled");
        const base = disabled ? entry.slice(0, -".disabled".length) : entry;
        if (!base.endsWith(".plist")) continue;
        items.push({
          id: `agent:${base}`,
          name: base.replace(/\.plist$/, ""),
          command: path.join(dir, entry),
          source: "launch-agent",
          enabled: !disabled,
          editable: true,
        });
      }
    } catch {
      // dir may not exist — fine
    }
  }
  return items;
}

async function toggleMacLoginItem(name: string, enabled: boolean): Promise<{ ok: boolean; error?: string }> {
  const backups = readBackups();
  const id = `login:${name}`;
  try {
    if (!enabled) {
      const { stdout } = await execFileAsync("osascript", [
        "-e",
        `tell application "System Events" to get the path of login item "${name}"`,
      ]);
      backups[id] = { name, command: stdout.trim() };
      writeBackups(backups);
      await execFileAsync("osascript", [
        "-e",
        `tell application "System Events" to delete login item "${name}"`,
      ]);
    } else {
      const backup = backups[id];
      if (!backup) return { ok: false, error: "no backup found to restore this login item" };
      await execFileAsync("osascript", [
        "-e",
        `tell application "System Events" to make login item at end with properties {path:"${backup.command}", hidden:false}`,
      ]);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function toggleMacLaunchAgent(base: string, enabled: boolean): Promise<{ ok: boolean; error?: string }> {
  const dir = path.join(home, "Library", "LaunchAgents");
  const activePath = path.join(dir, base);
  const disabledPath = path.join(dir, `${base}.disabled`);
  try {
    if (!enabled) {
      await execFileAsync("launchctl", ["unload", activePath]).catch(() => undefined);
      await fs.rename(activePath, disabledPath);
    } else {
      await fs.rename(disabledPath, activePath);
      await execFileAsync("launchctl", ["load", activePath]).catch(() => undefined);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function listStartupItems(): Promise<StartupItem[]> {
  if (isWin) {
    const [reg, folder] = await Promise.all([listWindowsRegistryRunItems(), listWindowsStartupFolderItems()]);
    return [...reg, ...folder];
  }
  if (isMac) {
    const [login, agents] = await Promise.all([listMacLoginItems(), listMacLaunchAgents()]);
    return [...login, ...agents];
  }
  return [];
}

export async function toggleStartupItem(id: string, enabled: boolean): Promise<{ ok: boolean; error?: string }> {
  const [prefix, ...rest] = id.split(":");
  const key = rest.join(":");
  if (prefix === "reg") return toggleWindowsRegistryItem(key, enabled);
  if (prefix === "folder") return toggleWindowsStartupFolderItem(key, enabled);
  if (prefix === "login") return toggleMacLoginItem(key, enabled);
  if (prefix === "agent") return toggleMacLaunchAgent(key, enabled);
  return { ok: false, error: `unknown startup item id: ${id}` };
}
