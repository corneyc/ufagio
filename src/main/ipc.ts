import { ipcMain } from "electron";
import { DeleteRequest } from "../shared/types";
import { allowedRootsForJunkDelete, scanJunk } from "./modules/junk";
import { allowedRootsForPrivacyDelete, scanPrivacy } from "./modules/privacy";
import { listStartupItems, toggleStartupItem } from "./modules/startup";
import { safeDelete } from "./modules/safeDelete";

export function registerIpcHandlers() {
  ipcMain.handle("scan-junk", async () => scanJunk());

  ipcMain.handle("delete-junk", async (_evt, req: DeleteRequest) => {
    return safeDelete(req.paths, allowedRootsForJunkDelete(), req.permanent);
  });

  ipcMain.handle("scan-privacy", async () => scanPrivacy());

  ipcMain.handle("clean-privacy", async (_evt, req: DeleteRequest) => {
    return safeDelete(req.paths, allowedRootsForPrivacyDelete(), req.permanent);
  });

  ipcMain.handle("list-startup-items", async () => listStartupItems());

  ipcMain.handle("toggle-startup-item", async (_evt, id: string, enabled: boolean) => {
    return toggleStartupItem(id, enabled);
  });
}
