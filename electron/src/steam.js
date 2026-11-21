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
    initSteamInput();
    coreLog().info(
      'Steam',
      `initialized app ${client.utils.getAppId()} as ${client.localplayer.getName()}`,
    );
  } catch (e) {
    // Expected whenever the Steam client isn't running, so it's info rather than an error.
    coreLog().info('Steam', 'not connected', e.message);
  }
};

// Up front, since Steam needs a few frames after Init before it lists any controllers; kept apart so a failure can't skip the overlay setup.
const initSteamInput = () => {
  try {
    client.input.init();
  } catch (e) {
    coreLog().warn('Steam', 'input init failed', e.message);
  }
};

// Steam Input's virtual pad hides the physical controller from the browser; the Deck's built-in pad can report Unknown.
const steamInputType = () => {
  const type = client.input.getControllers()[0]?.getType();
  if (type && type !== 'Unknown') return type;
  return client.utils.isSteamRunningOnSteamDeck()
    ? 'SteamDeckController'
    : undefined;
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

  ipcMain.handle('steam:input-type', () => {
    if (!client) return undefined;

    try {
      return steamInputType();
    } catch (e) {
      coreLog().warn('Steam', 'input type unavailable', e.message);
      return undefined;
    }
  });

  ipcMain.handle('steam:show-keyboard', (_event, x, y, width, height) => {
    const box = [x, y, width, height];
    if (!client || !box.every(Number.isFinite)) return false;

    // 0 = single line; the keyboard types into whichever field has focus.
    return client.utils
      .showFloatingGamepadTextInput(0, ...box.map(Math.round))
      .catch((e) => {
        coreLog().warn('Steam', 'keyboard unavailable', e.message);
        return false;
      });
  });

  ipcMain.handle('steam:achievement-clear', (_event, name) => {
    if (!client || !isAchievementName(name)) return false;

    coreLog().info('Steam', `achievement cleared ${name}`);
    return client.achievement.clear(name);
  });
};

module.exports = { initSteam, registerSteamHandlers };
