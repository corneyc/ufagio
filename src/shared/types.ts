export type RiskLevel = "safe" | "caution";

export interface JunkEntry {
  path: string;
  size: number;
  mtimeMs: number;
}

export interface JunkCategory {
  id: string;
  label: string;
  risk: RiskLevel;
  roots: string[];
  entries: JunkEntry[];
  totalSize: number;
  error?: string;
}

export interface JunkScanResult {
  categories: JunkCategory[];
  scannedAt: number;
}

export interface DeleteRequest {
  paths: string[];
  permanent: boolean;
}

export interface DeleteResultItem {
  path: string;
  ok: boolean;
  error?: string;
  // True when the file is locked by a running app (EBUSY and friends).
  // A normal, expected skip — not an error worth alarming the user over.
  inUse?: boolean;
}

export type StartupSource = "registry-run" | "startup-folder" | "login-item" | "launch-agent";

export interface StartupItem {
  id: string;
  name: string;
  command: string;
  source: StartupSource;
  enabled: boolean;
  editable: boolean;
}

export interface PrivacyCategory {
  id: string;
  label: string;
  browser: string;
  processRunning: boolean;
  roots: string[];
  entries: JunkEntry[];
  totalSize: number;
  error?: string;
}

export interface PrivacyScanResult {
  categories: PrivacyCategory[];
  scannedAt: number;
}

export interface VolumeInfo {
  mount: string;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  pctFree: number;
}

export interface InstalledProgram {
  name: string;
  sizeBytes: number;
}

export interface SpaceOverview {
  volumes: VolumeInfo[];
  installedPrograms: InstalledProgram[]; // empty on Linux (Win: registry, Mac: /Applications)
  scannedAt: number;
}

export type SpaceRisk = "safe" | "caution" | "danger";

export interface SpaceChild {
  name: string;
  path: string;
  isDir: boolean;
  sizeBytes: number;
  risk: SpaceRisk;
  label: string;
  reason: string;
  error?: string;
}

export interface SpaceListing {
  parent: string;
  children: SpaceChild[];
  scannedAt: number;
  // Set when the folder itself couldn't be read (permission-locked, e.g.
  // Windows's UWP package sandboxes) — distinguishes that from a folder
  // that's genuinely empty, which looks identical otherwise.
  error?: string;
}

export interface ApiBridge {
  scanJunk: () => Promise<JunkScanResult>;
  deleteJunk: (req: DeleteRequest) => Promise<DeleteResultItem[]>;
  listStartupItems: () => Promise<StartupItem[]>;
  toggleStartupItem: (id: string, enabled: boolean) => Promise<{ ok: boolean; error?: string }>;
  scanPrivacy: () => Promise<PrivacyScanResult>;
  cleanPrivacy: (req: DeleteRequest) => Promise<DeleteResultItem[]>;
  getSpaceOverview: () => Promise<SpaceOverview>;
  defaultSpaceRoot: () => Promise<string>;
  listSpaceChildren: (dirPath: string) => Promise<SpaceListing>;
  deleteSpaceItem: (req: DeleteRequest) => Promise<DeleteResultItem[]>;
  platform: () => NodeJS.Platform;
}
