const { app, screen } = require('electron');
const os = require('os');
const { coreLog, gameLog, logsDir } = require('./logging');

const sessionStart = Date.now();
const sinceStart = () => `+${Date.now() - sessionStart}ms`;

const logSessionHeader = () => {
  const log = coreLog();
  log.info('Session', `Started ${new Date().toString()}`);
  log.info(
    'Session',
    `App ${app.getName()} ${app.getVersion()} (packaged: ${app.isPackaged})`,
  );
  log.info(
    'Session',
    `Electron ${process.versions.electron}, Chrome ${process.versions.chrome}, Node ${process.versions.node}, V8 ${process.versions.v8}`,
  );
  log.info(
    'Session',
    `OS ${os.type()} ${os.release()} ${os.arch()} (${process.platform}), timezone ${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
  );
  log.info(
    'Session',
    `CPU ${os.cpus()[0]?.model ?? 'unknown'} x${os.cpus().length}, RAM ${Math.round(os.totalmem() / 1024 ** 3)}GB (${Math.round(os.freemem() / 1024 ** 3)}GB free)`,
  );
  log.info('Session', 'argv', process.argv);
  log.info('Session', `exe ${app.getPath('exe')}`);
  log.info('Session', `userData ${app.getPath('userData')}`);
  log.info('Session', `logs ${logsDir()}`);
  gameLog().info(
    'Session',
    `Started ${new Date().toString()}, app ${app.getVersion()}`,
  );
};

// Needs the app ready for displays and GPU info.
const logReadyDiagnostics = () => {
  const log = coreLog();
  log.info('App', `ready ${sinceStart()}, locale ${app.getLocale()}`);
  screen
    .getAllDisplays()
    .forEach((display, index) =>
      log.info(
        'Display',
        `#${index} bounds`,
        display.bounds,
        `workArea`,
        display.workArea,
        `scale ${display.scaleFactor}`,
      ),
    );
  log.info('GPU', 'feature status', app.getGPUFeatureStatus());
  app
    .getGPUInfo('basic')
    .then((info) => log.info('GPU', 'devices', info.gpuDevice))
    .catch((e) => log.warn('GPU', 'Could not read GPU info', e));
};

const watchAppLifecycle = () => {
  const log = coreLog();

  // The Monitor variant observes without replacing Electron's own crash handling.
  process.on('uncaughtExceptionMonitor', (e, origin) =>
    log.error('Process', `${origin}`, e),
  );
  process.on('unhandledRejection', (reason) =>
    log.error('Process', 'unhandledRejection', reason),
  );
  process.on('warning', (warning) => log.warn('Process', warning));

  app.on('second-instance', (_event, argv) =>
    log.info('App', 'second instance launched, focusing this one', argv),
  );
  app.on('window-all-closed', () => log.info('App', 'all windows closed'));
  app.on('before-quit', () => log.info('App', 'before-quit'));
  app.on('will-quit', () => log.info('App', 'will-quit'));
  app.on('quit', (_event, exitCode) =>
    log.info('App', `quit, exit code ${exitCode}, uptime ${sinceStart()}`),
  );
  app.on('child-process-gone', (_event, details) =>
    log.error('App', 'child process gone', details),
  );
  app.on('render-process-gone', (_event, _contents, details) =>
    log.error('App', 'render process gone', details),
  );
};

// The game's own logger lines ("[time] {Category}", ANSI-coloured) and uncaught errors already arrive with stacks over IPC.
const isAlreadyInGameLog = (message) =>
  /^\[[^\]]*\] \{[^}]*\}/.test(message.replaceAll(/\x1b\[[0-9;]*m/g, '')) ||
  message.startsWith('Uncaught');

// Catches what never reaches the game's logger: third-party console errors and anything before bootstrap.
const watchRendererConsole = (contents) => {
  let isGameLogAttached = false;

  contents.on('console-message', ({ level, message, sourceId, lineNumber }) => {
    if (level !== 'error') return;
    if (isGameLogAttached && isAlreadyInGameLog(message)) return;
    gameLog().error(
      'Renderer:Console',
      `${message} (${sourceId}:${lineNumber})`,
    );
  });
  // Commit rather than start, so late logs from the outgoing page can't re-attach over the new one.
  contents.on('did-navigate', () => (isGameLogAttached = false));
  contents.on('render-process-gone', () => (isGameLogAttached = false));

  return () => {
    if (!isGameLogAttached)
      coreLog().info('Renderer', `game logger attached ${sinceStart()}`);
    isGameLogAttached = true;
  };
};

const watchWindowLifecycle = (win) => {
  const log = coreLog();
  const contents = win.webContents;

  log.info(
    'Window',
    `created ${sinceStart()}`,
    win.getBounds(),
    `fullscreen ${win.isFullScreen()}`,
  );
  win.once('ready-to-show', () =>
    log.info('Window', `ready-to-show ${sinceStart()}`),
  );
  win.once('show', () =>
    log.info('Window', `shown ${sinceStart()}, maximized ${win.isMaximized()}`),
  );
  win.on('unresponsive', () => log.warn('Window', 'renderer unresponsive'));
  win.on('responsive', () => log.info('Window', 'renderer responsive again'));
  win.on('close', () => log.info('Window', 'close requested'));
  win.on('closed', () => log.info('Window', 'closed'));
  [
    'enter-full-screen',
    'leave-full-screen',
    'maximize',
    'unmaximize',
    'minimize',
    'restore',
  ].forEach((event) => win.on(event, () => log.info('Window', event)));

  contents.on('did-start-loading', () =>
    log.info('Load', `did-start-loading ${sinceStart()}`),
  );
  contents.on('dom-ready', () => log.info('Load', `dom-ready ${sinceStart()}`));
  contents.on('did-finish-load', () =>
    log.info('Load', `did-finish-load ${sinceStart()}`),
  );
  contents.on('did-navigate', (_event, url, httpCode) =>
    log.info('Load', `did-navigate ${url} (${httpCode})`),
  );
  contents.on('did-fail-load', (_event, code, description, url, isMainFrame) =>
    log.error(
      'Load',
      `did-fail-load ${code} ${description} ${url} (main frame: ${isMainFrame})`,
    ),
  );
  contents.on('preload-error', (_event, preloadPath, error) =>
    log.error('Load', `preload-error ${preloadPath}`, error),
  );
  contents.on('render-process-gone', (_event, details) =>
    log.error('Renderer', 'process gone', details),
  );
  contents.on('plugin-crashed', (_event, name, version) =>
    log.error('Renderer', `plugin crashed ${name} ${version}`),
  );

  return watchRendererConsole(contents);
};

module.exports = {
  logReadyDiagnostics,
  logSessionHeader,
  sinceStart,
  watchAppLifecycle,
  watchWindowLifecycle,
};
