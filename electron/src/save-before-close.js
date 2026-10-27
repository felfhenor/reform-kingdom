const { app, ipcMain } = require('electron');

// Long enough for a large IndexedDB write, short enough that a hung renderer can't keep the game open.
const SAVE_TIMEOUT_MS = 5000;

// How long "close again to quit without saving" stays armed after a failed save.
const SKIP_SAVE_WINDOW_MS = 10000;

// Holds a close until the renderer confirms its save landed, so a long autosave interval loses nothing.
const watchSaveBeforeClose = (win) => {
  let canClose = false;
  let isSaving = false;
  let isQuitting = false;
  let isRendererListening = false;
  let skipSaveTimeout;

  // Cmd+Q closes windows as part of quitting; holding that close cancels the quit, so it's resumed after.
  app.on('before-quit', () => (isQuitting = true));

  ipcMain.on('window:save-before-close:ready', (event) => {
    if (event.sender === win.webContents) isRendererListening = true;
  });
  win.webContents.on('did-navigate', () => (isRendererListening = false));
  win.webContents.on(
    'render-process-gone',
    () => (isRendererListening = false),
  );

  const closeNow = () => {
    canClose = true;
    if (win.isDestroyed()) return;
    if (isQuitting) app.quit();
    else win.close();
  };

  const finish = (saved) => {
    isSaving = false;
    if (saved) return closeNow();

    isQuitting = false;
    canClose = true;
    clearTimeout(skipSaveTimeout);
    skipSaveTimeout = setTimeout(() => (canClose = false), SKIP_SAVE_WINDOW_MS);
  };

  win.on('close', (event) => {
    if (canClose || !isRendererListening) return;
    event.preventDefault();
    if (isSaving) return;
    isSaving = true;

    const onDone = (ipcEvent, saved) => {
      if (ipcEvent.sender !== win.webContents) return;
      clearTimeout(timeout);
      ipcMain.removeListener('window:save-before-close:done', onDone);
      finish(saved);
    };
    const timeout = setTimeout(() => {
      ipcMain.removeListener('window:save-before-close:done', onDone);
      finish(true);
    }, SAVE_TIMEOUT_MS);

    ipcMain.on('window:save-before-close:done', onDone);
    win.webContents.send('window:save-before-close');
  });
};

module.exports = { watchSaveBeforeClose };
