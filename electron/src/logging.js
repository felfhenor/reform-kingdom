const { app, ipcMain, shell } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const util = require('util');

// The current session's file plus this many previous ones.
const KEPT_SESSIONS = 5;

// A renderer stuck throwing every frame would otherwise fill the disk in one session.
const MAX_LOG_BYTES = 50 * 1024 * 1024;

// Above the renderer's own cap, so its truncation marker survives; this only bounds main-process dumps and misbehaving senders.
const MAX_ENTRY_LENGTH = 25000;

const LEVELS = ['debug', 'log', 'info', 'warn', 'error'];

// Dev runs share userData with the installed game, so they get their own folder to keep its logs.
const logsDir = () =>
  path.join(app.getPath('userData'), app.isPackaged ? 'logs' : 'logs-dev');

const logFilePath = (name, index) =>
  path.join(logsDir(), index === 0 ? `${name}.log` : `${name}.${index}.log`);

// name.log -> name.1.log -> ... -> name.4.log, dropping the oldest.
const rotateLogFiles = (name) => {
  fs.rmSync(logFilePath(name, KEPT_SESSIONS - 1), { force: true });
  for (let index = KEPT_SESSIONS - 2; index >= 0; index--) {
    const from = logFilePath(name, index);
    if (fs.existsSync(from)) fs.renameSync(from, logFilePath(name, index + 1));
  }
};

const truncate = (text) =>
  text.length <= MAX_ENTRY_LENGTH
    ? text
    : `${text.slice(0, MAX_ENTRY_LENGTH)}... [truncated ${text.length - MAX_ENTRY_LENGTH} chars]`;

// Paths under the home folder carry the OS username, and these files get shared with the developer.
const homePatterns = [os.homedir(), os.homedir().replaceAll('\\', '/')];
const redactHome = (text) =>
  homePatterns.reduce((result, home) => result.replaceAll(home, '~'), text);

const formatLine = (level, category, message) =>
  `${new Date().toISOString()} [${level.toUpperCase().padEnd(5)}] {${category}} ${redactHome(truncate(message))}\n`;

// A locked file (open in an editor, held by antivirus) can block rotation; appending still keeps this session's lines.
const openSessionFile = (name) => {
  fs.mkdirSync(logsDir(), { recursive: true });
  try {
    rotateLogFiles(name);
    return fs.openSync(logFilePath(name, 0), 'w');
  } catch (e) {
    console.error(`Could not rotate ${name}.log`, e);
    return fs.openSync(logFilePath(name, 0), 'a');
  }
};

// Sync writes so the last lines before a hard crash still reach the disk.
const createSessionLog = (name) => {
  let fd;
  let bytes = 0;
  let isFull = false;
  let lastEntry;
  let repeats = 0;
  let lastRepeatAt;

  try {
    fd = openSessionFile(name);
  } catch (e) {
    console.error(`Could not open ${name}.log`, e);
  }

  const writeLine = (line) => {
    if (fd === undefined || isFull) return;
    try {
      fs.writeSync(fd, line);
      bytes += Buffer.byteLength(line);
      if (bytes < MAX_LOG_BYTES) return;
      isFull = true;
      fs.writeSync(
        fd,
        formatLine(
          'warn',
          'Log',
          'Size limit reached; logging stopped for this session.',
        ),
      );
    } catch {
      // A failing log write must never take the game down with it.
    }
  };

  const emit = (level, category, message) => {
    const line = formatLine(level, category, message);
    if (!app.isPackaged) process.stdout.write(`[${name}] ${line}`);
    writeLine(line);
  };

  const flush = () => {
    if (repeats > 0)
      emit(
        'info',
        'Log',
        `Previous message repeated ${repeats} more times, last at ${lastRepeatAt}.`,
      );
    repeats = 0;
  };

  // An error thrown every frame would otherwise hit the size cap and lose the crash that follows it.
  const write = (level, category, message) => {
    const entry = `${level}|${category}|${message}`;
    if (entry === lastEntry) {
      repeats++;
      lastRepeatAt = new Date().toISOString();
      return;
    }
    flush();
    lastEntry = entry;
    emit(level, category, message);
  };

  return withLevels(write, flush);
};

// Adds log.info(category, ...data) style calls that format like console.log does.
const withLevels = (write, flush = () => {}) => {
  const logger = { write, flush };
  LEVELS.forEach((level) => {
    logger[level] = (category, ...data) =>
      write(
        level,
        category,
        util.formatWithOptions({ depth: 5, breakLength: Infinity }, ...data),
      );
  });
  return logger;
};

const noopLog = withLevels(() => {});

// Stays a no-op until initLogging, so a second instance or installer run can't rotate away the live session's logs.
const logs = { core: noopLog, game: noopLog };

const initLogging = () => {
  logs.core = createSessionLog('core');
  logs.game = createSessionLog('game');
  app.on('quit', () => {
    logs.game.flush();
    logs.core.flush();
  });
};

const coreLog = () => logs.core;
const gameLog = () => logs.game;

const asString = (value) => (typeof value === 'string' ? value : String(value));

// Everything here comes from the renderer, so it's coerced rather than trusted.
const registerLogHandlers = (onRendererLog) => {
  ipcMain.on('log:write', (event, level, category, message) => {
    onRendererLog(event.sender);
    logs.game.write(
      LEVELS.includes(level) ? level : 'log',
      asString(category).slice(0, 200).replaceAll(/\s/g, ' '),
      asString(message),
    );
  });

  // openPath resolves to an error string rather than rejecting.
  ipcMain.handle('log:open-folder', async () => {
    fs.mkdirSync(logsDir(), { recursive: true });
    const error = await shell.openPath(logsDir());
    if (error) logs.core.warn('Log', 'Could not open logs folder', error);
    return !error;
  });
};

module.exports = {
  coreLog,
  gameLog,
  initLogging,
  logFilePath,
  logsDir,
  registerLogHandlers,
};
