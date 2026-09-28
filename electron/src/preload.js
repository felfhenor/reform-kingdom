const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('reformElectron', {
  savefileBackupWrite: (id, json) =>
    ipcRenderer.invoke('savefile-backup:write', id, json),
  savefileBackupReadAll: () => ipcRenderer.invoke('savefile-backup:read-all'),
  savefileBackupPrune: (keepIds) =>
    ipcRenderer.invoke('savefile-backup:prune', keepIds),
});
