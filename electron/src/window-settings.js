const { ipcMain, screen } = require('electron');

// Sizes cross IPC in physical pixels so presets mean the same thing at any display scaling.
const windowState = (win, fullscreen = win.isFullScreen()) => {
  const { workArea, scaleFactor } = screen.getDisplayMatching(
    win.getNormalBounds(),
  );
  const [outerWidth, outerHeight] = win.getSize();
  const [contentWidth, contentHeight] = win.getContentSize();
  const [minOuterWidth, minOuterHeight] = win.getMinimumSize();
  const frameWidth = outerWidth - contentWidth;
  const frameHeight = outerHeight - contentHeight;
  const px = (dip) => Math.round(dip * scaleFactor);

  return {
    fullscreen,
    maximized: win.isMaximized(),
    scaleFactor,
    width: px(contentWidth),
    height: px(contentHeight),
    minWidth: px(minOuterWidth - frameWidth),
    minHeight: px(minOuterHeight - frameHeight),
    maxWidth: px(workArea.width - frameWidth),
    maxHeight: px(workArea.height - frameHeight),
  };
};

let pushTimer;

const pushWindowState = (win) => {
  clearTimeout(pushTimer);
  if (win && !win.isDestroyed())
    win.webContents.send('window:changed', windowState(win));
};

// Drags and fullscreen animations fire bursts of resize/move events; only the settled state matters.
const pushWindowStateSoon = (win) => {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => pushWindowState(win), 150);
};

// On macOS isFullScreen() only flips once these events fire, so they push immediately.
const watchWindowState = (win) => {
  ['enter-full-screen', 'leave-full-screen', 'maximize', 'unmaximize'].forEach(
    (event) => win.on(event, () => pushWindowState(win)),
  );
  ['resize', 'move'].forEach((event) =>
    win.on(event, () => pushWindowStateSoon(win)),
  );
};

const registerWindowSettingsHandlers = (getWindow) => {
  screen.on('display-metrics-changed', () => pushWindowStateSoon(getWindow()));

  ipcMain.handle('window:get', () => {
    const win = getWindow();
    return win ? windowState(win) : undefined;
  });

  // Reports the requested mode since the fullscreen transition can still be animating.
  ipcMain.handle('window:set-fullscreen', (_event, fullscreen) => {
    const win = getWindow();
    if (!win) return undefined;

    win.setFullScreen(!!fullscreen);
    return windowState(win, !!fullscreen);
  });

  // Sizes come from the renderer, so anything outside what the display and window minimum allow is ignored.
  ipcMain.handle('window:set-size', (_event, width, height) => {
    const win = getWindow();
    if (!win) return undefined;

    const state = windowState(win);
    const isValid =
      Number.isInteger(width) &&
      Number.isInteger(height) &&
      width >= state.minWidth &&
      height >= state.minHeight &&
      width <= state.maxWidth &&
      height <= state.maxHeight;
    if (isValid && !win.isFullScreen()) {
      if (win.isMaximized()) win.unmaximize();
      win.setContentSize(
        Math.round(width / state.scaleFactor),
        Math.round(height / state.scaleFactor),
      );
      win.center();
    }

    return windowState(win);
  });
};

module.exports = { registerWindowSettingsHandlers, watchWindowState };
