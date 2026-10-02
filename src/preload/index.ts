import { contextBridge, ipcRenderer } from "electron";
import {
  ApiBridge,
  DeleteRequest,
} from "../shared/types";

const api: ApiBridge = {
  scanJunk: () => ipcRenderer.invoke("scan-junk"),
  deleteJunk: (req: DeleteRequest) => ipcRenderer.invoke("delete-junk", req),
  listStartupItems: () => ipcRenderer.invoke("list-startup-items"),
  toggleStartupItem: (id: string, enabled: boolean) => ipcRenderer.invoke("toggle-startup-item", id, enabled),
  scanPrivacy: () => ipcRenderer.invoke("scan-privacy"),
  cleanPrivacy: (req: DeleteRequest) => ipcRenderer.invoke("clean-privacy", req),
  getSpaceOverview: () => ipcRenderer.invoke("get-space-overview"),
  defaultSpaceRoot: () => ipcRenderer.invoke("default-space-root"),
  listSpaceChildren: (dirPath: string) => ipcRenderer.invoke("list-space-children", dirPath),
  deleteSpaceItem: (req: DeleteRequest) => ipcRenderer.invoke("delete-space-item", req),
  platform: () => process.platform,
};

contextBridge.exposeInMainWorld("api", api);
