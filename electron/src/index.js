const { app, screen, shell, BrowserWindow } = require('electron');
const path = require('path');
const url = require('url');

const rpc = require('discord-rpc');

const Config = require('electron-config');
const { registerSavefileBackupHandlers } = require('./savefile-backups');
const {
  registerWindowSettingsHandlers,
  watchFullscreenHotkeys,
  watchWindowState,
  windowRestorableBounds,
} = require('./window-settings');
const config = new Config();

const showDevTools = process.argv.includes('--dev');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// A second copy would tick and save the same game alongside this one.
const hasInstanceLock = app.requestSingleInstanceLock();
if (!hasInstanceLock) {
  app.exit(0);
}

let mainWindow = undefined;

app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

const createWindow = () => {
  const { workArea } = screen.getPrimaryDisplay();
  const workAreas = screen.getAllDisplays().map((display) => display.workArea);

  // Capped at the smallest display so a small or heavily scaled laptop screen can still fit the whole window.
  const opts = {
    show: false,
    icon: './icons/icon.png',
    minWidth: Math.min(1280, ...workAreas.map((area) => area.width)),
    minHeight: Math.min(720, ...workAreas.map((area) => area.height)),
    ...workArea,
    ...windowRestorableBounds(config.get('winBounds')),
  };
  // Only ever set to true: an explicit false disables the fullscreen button on macOS.
  if (config.get('fullscreen')) opts.fullscreen = true;

  // Create the browser window.
  mainWindow = new BrowserWindow({
    ...opts,
    webPreferences: {
      nodeIntegration: true,
      autoplayPolicy: 'no-user-gesture-required',
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.setMenu(null);
  mainWindow.once('ready-to-show', () => {
    // The two flags are saved at different times, so a killed fullscreen session can leave both set.
    if (config.get('maximized') && !mainWindow.isFullScreen())
      mainWindow.maximize();
    mainWindow.show();
  });

  // Saved as it changes so a killed process still remembers it.
  mainWindow.on('enter-full-screen', () => config.set('fullscreen', true));
  mainWindow.on('leave-full-screen', () => config.set('fullscreen', false));

  // Normal bounds, so a maximized or fullscreen close doesn't reopen as a screen-sized plain window.
  mainWindow.on('close', () => {
    config.set('winBounds', mainWindow.getNormalBounds());
    config.set('maximized', mainWindow.isMaximized());
  });

  watchWindowState(mainWindow);
  watchFullscreenHotkeys(mainWindow);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // and load the index.html of the app.
  const indexPath =
    process.env.APP_URL || path.join(__dirname, '..', 'browser', 'index.html');

  // prod or prod-like
  if (indexPath.includes('.html')) {
    const filePath = url.format({
      pathname: indexPath,
      protocol: 'file:',
      slashes: true,
    });

    setTimeout(() => {
      mainWindow.loadURL(filePath);
    }, 0);

    // dev or dev-like
  } else {
    mainWindow.loadURL(indexPath);
  }

  // Open the DevTools in dev mode
  if (showDevTools) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = undefined;
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  registerSavefileBackupHandlers();
  registerWindowSettingsHandlers(() => mainWindow);
  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (!mainWindow || BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

const DISCORD_CLIENT_ID = '1538621457343455332';

const handleRPC = () => {
  const isRegistered = rpc.register(DISCORD_CLIENT_ID); // only needed if we want spectate / join / ask to join
  if (!isRegistered) return;

  const rpcClient = new rpc.Client({ transport: 'ipc' });
  let startTimestamp;

  const setActivity = () => {
    if (!rpcClient || !mainWindow) {
      return;
    }

    mainWindow.webContents
      .executeJavaScript('window.discordRPCStatus')
      .then((result) => {
        if (!result) {
          rpcClient.clearActivity();
          startTimestamp = null;
          return;
        }

        if (!startTimestamp) {
          startTimestamp = new Date();
        }

        rpcClient.setActivity({
          startTimestamp,
          state: result.state || 'Idle',
          details: result.details,
          smallImageKey: result.smallImageKey,
          smallImageText: result.smallImageText,
          largeImageKey: result.largeImageKey || 'defaultimage',
          largeImageText: result.largeImageText,
        });
      });
  };

  rpcClient.on('ready', () => {
    setActivity();

    setInterval(() => {
      setActivity();
    }, 15e3);
  });

  rpcClient.login({ clientId: DISCORD_CLIENT_ID }).catch(console.error);
};

if (hasInstanceLock) handleRPC();
