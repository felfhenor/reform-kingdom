const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('reformElectron', {
  logWrite: (level, category, message) =>
    ipcRenderer.send('log:write', level, category, message),
  logOpenFolder: () => ipcRenderer.invoke('log:open-folder'),
  savefileWrite: (json) => ipcRenderer.invoke('savefile:write', json),
  savefileRead: () => ipcRenderer.invoke('savefile:read'),
  savefileOpenFolder: () => ipcRenderer.invoke('savefile:open-folder'),
  savefileExportWithLogs: () => ipcRenderer.invoke('savefile:export-with-logs'),
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
  // A throwing save still answers, so the main process doesn't sit out its timeout.
  windowOnSaveBeforeClose: (callback) => {
    const listener = () =>
      Promise.resolve()
        .then(callback)
        .catch(() => false)
        .then((saved) =>
          ipcRenderer.send('window:save-before-close:done', saved),
        );
    ipcRenderer.on('window:save-before-close', listener);
    ipcRenderer.send('window:save-before-close:ready');
    return () =>
      ipcRenderer.removeListener('window:save-before-close', listener);
  },
  windowOnChange: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('window:changed', listener);
    return () => ipcRenderer.removeListener('window:changed', listener);
  },
});
