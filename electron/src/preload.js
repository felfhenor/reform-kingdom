const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('reformElectron', {
  savefileBackupWrite: (id, json) =>
    ipcRenderer.invoke('savefile-backup:write', id, json),
  savefileBackupReadAll: () => ipcRenderer.invoke('savefile-backup:read-all'),
  savefileBackupPrune: (keepIds) =>
    ipcRenderer.invoke('savefile-backup:prune', keepIds),
  windowGet: () => ipcRenderer.invoke('window:get'),
  windowSetFullscreen: (fullscreen) =>
    ipcRenderer.invoke('window:set-fullscreen', fullscreen),
  windowSetSize: (width, height) =>
    ipcRenderer.invoke('window:set-size', width, height),
  windowOnChange: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('window:changed', listener);
    return () => ipcRenderer.removeListener('window:changed', listener);
  },
});
