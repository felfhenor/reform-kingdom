const { app, ipcMain, shell } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const { coreLog, logsDir } = require('./logging');
const {
  configure,
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipWriter,
} = require('@zip.js/zip.js');

// Dev runs share userData with the installed game, so they get their own folder to keep its save.
const savefileDir = () =>
  path.join(
    app.getPath('userData'),
    app.isPackaged ? 'savefiles' : 'savefiles-dev',
  );

const savefilePath = () => path.join(savefileDir(), 'savefile.json');
const savefileTempPath = () => `${savefilePath()}.tmp`;
const legacyPath = () => path.join(savefileDir(), 'legacy.json');

const syncFile = async (file, contents) => {
  const handle = await fs.open(file, contents ? 'w' : 'r+');
  try {
    if (contents) await handle.writeFile(contents, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
};

// Copied rather than renamed so the tmp stays a complete fallback if the copy is cut short.
const writeFileNow = async (file, json) => {
  await fs.mkdir(savefileDir(), { recursive: true });
  await syncFile(`${file}.tmp`, json);
  await fs.copyFile(`${file}.tmp`, file);
  await syncFile(file);
};

// Serialized so two writes can never interleave on the same tmp file, and quitting waits for all of them.
let writeQueue = Promise.resolve();

const queueWrite = (file, json, label) => {
  const write = writeQueue.then(() => writeFileNow(file, String(json)));
  writeQueue = write.catch(() => {});
  return write.then(
    () => true,
    (e) => {
      coreLog().error('Savefile', `${label} write failed`, e);
      return false;
    },
  );
};

const writeSavefile = (_event, json) =>
  queueWrite(savefilePath(), json, 'savefile');

const writeLegacy = (_event, json) => queueWrite(legacyPath(), json, 'legacy');

// Resolves the file's save stamp alongside it, so the newer of the two copies can be chosen.
const readParseable = async (file) => {
  try {
    const json = await fs.readFile(file, 'utf8');
    return { json, savedAt: JSON.parse(json)?.meta?.savedAt ?? 0 };
  } catch (e) {
    if (e.code !== 'ENOENT')
      coreLog().warn('Savefile', `unreadable ${file}`, e);
    return undefined;
  }
};

const readSavefile = async () => {
  await writeQueue;

  // The tmp is newer when its copy over savefile.json failed or was cut short.
  const main = await readParseable(savefilePath());
  const temp = await readParseable(savefileTempPath());
  if (temp && (!main || temp.savedAt > main.savedAt)) {
    coreLog().warn(
      'Savefile',
      'savefile.json missing or stale, read the tmp copy',
    );
    return temp.json;
  }
  return main?.json;
};

// Undefined only when the file doesn't exist; a locked or garbled file throws, so it's never mistaken for missing and overwritten.
const readJsonOrMissing = async (file) => {
  try {
    const json = await fs.readFile(file, 'utf8');
    JSON.parse(json);
    return json;
  } catch (e) {
    if (e.code === 'ENOENT') return undefined;
    throw e;
  }
};

// Legacy carries no save stamp; the tmp is only the fallback when legacy.json is missing or unreadable.
const readLegacy = async () => {
  await writeQueue;

  let mainError;
  try {
    const main = await readJsonOrMissing(legacyPath());
    if (main) return main;
  } catch (e) {
    mainError = e;
    coreLog().warn(
      'Savefile',
      'legacy.json unreadable, trying the tmp copy',
      e,
    );
  }

  const temp = await readJsonOrMissing(`${legacyPath()}.tmp`).catch(
    () => undefined,
  );
  if (temp) return temp;
  if (mainError) throw mainError;
  return undefined;
};

// openPath resolves to an error string rather than rejecting.
const openSavefileFolder = async () => {
  await fs.mkdir(savefileDir(), { recursive: true });
  const error = await shell.openPath(savefileDir());
  if (error)
    coreLog().warn('Savefile', 'Could not open savefile folder', error);
  return !error;
};

const readZipEntry = async (dir, zipFolder, name) => {
  try {
    return {
      name: `${zipFolder}/${name}`,
      data: await fs.readFile(path.join(dir, name)),
    };
  } catch (e) {
    coreLog().warn('Savefile', `left ${name} out of the export`, e);
    return undefined;
  }
};

// A locked or odd file is skipped rather than failing the export, since that's when players need it most.
const readFolderFiles = async (dir, zipFolder) => {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (e) {
    if (e.code !== 'ENOENT')
      coreLog().warn('Savefile', `could not list ${dir} for export`, e);
    return [];
  }

  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map((entry) => readZipEntry(dir, zipFolder, entry.name)),
  );
  return files.filter(Boolean);
};

// The main process has no web workers to hand compression off to.
configure({ useWebWorkers: false });

const createZip = async (files) => {
  const zip = new ZipWriter(new Uint8ArrayWriter());
  for (const { name, data } of files)
    await zip.add(name, new Uint8ArrayReader(data));
  return zip.close();
};

// Written straight to Downloads and revealed, so a player can attach it to a bug report in two clicks.
const exportWithLogs = async () => {
  try {
    await writeQueue;
    const files = [
      ...(await readFolderFiles(savefileDir(), 'savefiles')),
      ...(await readFolderFiles(logsDir(), 'logs')),
    ];
    const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
    const target = path.join(
      app.getPath('downloads'),
      `reformkingdom-savefile-and-logs-${stamp}.zip`,
    );
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, await createZip(files));
    coreLog().info('Savefile', `exported ${files.length} files to ${target}`);
    shell.showItemInFolder(target);
    return true;
  } catch (e) {
    coreLog().error('Savefile', 'export with logs failed', e);
    return false;
  }
};

// Matches the close-save timeout: long enough for a big write, short enough that a stalled disk can't keep the game running.
const QUIT_WRITE_TIMEOUT_MS = 5000;

// The last save on close is often still mid-copy when the app starts quitting.
const finishWritesBeforeQuit = () => {
  let isFinished = false;
  app.on('will-quit', (event) => {
    if (isFinished) return;
    event.preventDefault();

    const timeout = new Promise((resolve) =>
      setTimeout(() => resolve('timeout'), QUIT_WRITE_TIMEOUT_MS),
    );
    void Promise.race([writeQueue, timeout]).then((result) => {
      if (result === 'timeout')
        coreLog().warn('Savefile', 'quitting with a save still being written');
      isFinished = true;
      app.quit();
    });
  });
};

const registerSavefileStoreHandlers = () => {
  finishWritesBeforeQuit();
  coreLog().info('Savefile', `savefile at ${savefilePath()}`);
  ipcMain.handle('savefile:write', writeSavefile);
  ipcMain.handle('savefile:read', readSavefile);
  ipcMain.handle('savefile:open-folder', openSavefileFolder);
  ipcMain.handle('savefile:export-with-logs', exportWithLogs);
  ipcMain.handle('legacy:write', writeLegacy);
  ipcMain.handle('legacy:read', readLegacy);
};

module.exports = { registerSavefileStoreHandlers };
