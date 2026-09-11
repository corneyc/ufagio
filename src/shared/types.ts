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

export interface ApiBridge {
  scanJunk: () => Promise<JunkScanResult>;
  deleteJunk: (req: DeleteRequest) => Promise<DeleteResultItem[]>;
  listStartupItems: () => Promise<StartupItem[]>;
  toggleStartupItem: (id: string, enabled: boolean) => Promise<{ ok: boolean; error?: string }>;
  scanPrivacy: () => Promise<PrivacyScanResult>;
  cleanPrivacy: (req: DeleteRequest) => Promise<DeleteResultItem[]>;
  platform: () => NodeJS.Platform;
}
