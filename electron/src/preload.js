const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('reformElectron', {
  logWrite: (level, category, message) =>
    ipcRenderer.send('log:write', level, category, message),
  logOpenFolder: () => ipcRenderer.invoke('log:open-folder'),
  savefileWrite: (json) => ipcRenderer.invoke('savefile:write', json),
  savefileRead: () => ipcRenderer.invoke('savefile:read'),
  savefileOpenFolder: () => ipcRenderer.invoke('savefile:open-folder'),
  savefileExportWithLogs: () => ipcRenderer.invoke('savefile:export-with-logs'),
  legacyWrite: (json) => ipcRenderer.invoke('legacy:write', json),
  legacyRead: () => ipcRenderer.invoke('legacy:read'),
  demoSaveRead: () => ipcRenderer.invoke('demo-save:read'),
  savefileBackupWrite: (id, json) =>
    ipcRenderer.invoke('savefile-backup:write', id, json),
  savefileBackupReadAll: () => ipcRenderer.invoke('savefile-backup:read-all'),
  savefileBackupPrune: (keepIds) =>
    ipcRenderer.invoke('savefile-backup:prune', keepIds),
  steamAchievementsActivate: (names) =>
    ipcRenderer.invoke('steam:achievements-activate', names),
  steamAchievementClear: (name) =>
    ipcRenderer.invoke('steam:achievement-clear', name),
  steamInputType: () => ipcRenderer.invoke('steam:input-type'),
  steamShowKeyboard: (x, y, width, height) =>
    ipcRenderer.invoke('steam:show-keyboard', x, y, width, height),
  windowGet: () => ipcRenderer.invoke('window:get'),
  windowSetFullscreen: (fullscreen) =>
    ipcRenderer.invoke('window:set-fullscreen', fullscreen),
  windowSetSize: (width, height) =>
    ipcRenderer.invoke('window:set-size', width, height),
  windowFlash: () => ipcRenderer.send('window:flash'),
  windowNotify: (title, body) => ipcRenderer.send('window:notify', title, body),
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
