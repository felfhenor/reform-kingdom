const { app, ipcMain } = require('electron');
const { coreLog } = require('./logging');

// STEAM_APP_ID=480 tests against Valve's Spacewar sample; unset, a Steam launch supplies the ID itself.
const STEAM_APP_ID = Number(process.env.STEAM_APP_ID) || undefined;

let client = undefined;

// The overlay only redraws when the page does, so an idle screen would freeze it mid-animation.
const repaintForOverlay = (win) => {
  const timer = setInterval(() => {
    if (win.isDestroyed()) return clearInterval(timer);
    if (win.isVisible() && !win.isMinimized()) win.webContents.invalidate();
  }, 1000 / 60);
};

// Must run before app ready: the overlay needs command-line switches that only apply at startup.
const initSteam = () => {
  try {
    const steamworks = require('steamworks.js');
    client = steamworks.init(STEAM_APP_ID);
    // Its own repaint timer would keep running while minimized.
    steamworks.electronEnableSteamOverlay(true);
    // Partial swaps only redraw what changed, leaving the closed overlay's bar burned into static screens.
    app.commandLine.appendSwitch('ui-disable-partial-swap');
    app.on('browser-window-created', (_event, win) => repaintForOverlay(win));
    coreLog().info(
      'Steam',
      `initialized app ${client.utils.getAppId()} as ${client.localplayer.getName()}`,
    );
  } catch (e) {
    // Expected whenever the Steam client isn't running, so it's info rather than an error.
    coreLog().info('Steam', 'not connected', e.message);
  }
};

const isAchievementName = (name) =>
  typeof name === 'string' && /^\w+$/.test(name);

const registerSteamHandlers = () => {
  // Answers with the names newly set, so already-set ones can be re-sent freely.
  ipcMain.handle('steam:achievements-activate', (_event, names) => {
    if (!client || !Array.isArray(names)) return [];

    const pending = names
      .filter(isAchievementName)
      .filter((name) => !client.achievement.isActivated(name));
    const activated = pending.filter((name) =>
      client.achievement.activate(name),
    );
    const failed = pending.filter((name) => !activated.includes(name));
    if (activated.length > 0)
      coreLog().info('Steam', 'achievements activated', activated);
    // Usually a name missing from the Steamworks partner site.
    if (failed.length > 0)
      coreLog().warn('Steam', 'achievements not activated', failed);
    return activated;
  });

  ipcMain.handle('steam:achievement-clear', (_event, name) => {
    if (!client || !isAchievementName(name)) return false;

    coreLog().info('Steam', `achievement cleared ${name}`);
    return client.achievement.clear(name);
  });
};

module.exports = { initSteam, registerSteamHandlers };
