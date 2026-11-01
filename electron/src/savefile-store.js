const { app, ipcMain, shell } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const { coreLog } = require('./logging');

// Dev runs share userData with the installed game, so they get their own folder to keep its save.
const savefileDir = () =>
  path.join(
    app.getPath('userData'),
    app.isPackaged ? 'savefiles' : 'savefiles-dev',
  );

const savefilePath = () => path.join(savefileDir(), 'savefile.json');
const savefileTempPath = () => `${savefilePath()}.tmp`;

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
const writeSavefileNow = async (json) => {
  await fs.mkdir(savefileDir(), { recursive: true });
  await syncFile(savefileTempPath(), json);
  await fs.copyFile(savefileTempPath(), savefilePath());
  await syncFile(savefilePath());
};

// Serialized so two saves can never interleave on the same tmp file.
let writeQueue = Promise.resolve();

const writeSavefile = (_event, json) => {
  const write = writeQueue.then(() => writeSavefileNow(String(json)));
  writeQueue = write.catch(() => {});
  return write.then(
    () => true,
    (e) => {
      coreLog().error('Savefile', 'write failed', e);
      return false;
    },
  );
};

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

// openPath resolves to an error string rather than rejecting.
const openSavefileFolder = async () => {
  await fs.mkdir(savefileDir(), { recursive: true });
  const error = await shell.openPath(savefileDir());
  if (error)
    coreLog().warn('Savefile', 'Could not open savefile folder', error);
  return !error;
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
};

module.exports = { registerSavefileStoreHandlers };
