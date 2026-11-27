const { app, ipcMain, shell } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const { coreLog } = require('./logging');

const MAX_MOD_BYTES = 200 * 1024 * 1024;

// Dev runs share userData with the installed game, so they get their own folder.
const modsDir = () =>
  path.join(app.getPath('userData'), app.isPackaged ? 'mods' : 'mods-dev');

// Names come from the renderer, so anything that could escape the mods folder is rejected.
const modPath = (name) => {
  if (
    typeof name !== 'string' ||
    name !== path.basename(name) ||
    name.startsWith('.')
  ) {
    throw new Error(`Invalid mod name: ${name}`);
  }
  return path.join(modsDir(), name);
};

const listMods = async () => {
  await fs.mkdir(modsDir(), { recursive: true });
  const entries = await fs.readdir(modsDir(), { withFileTypes: true });
  return entries
    .filter(
      (entry) =>
        entry.isDirectory() ||
        (entry.isFile() && entry.name.toLowerCase().endsWith('.zip')),
    )
    .map((entry) => entry.name);
};

const walkFiles = async (root, dir = root) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => !entry.isSymbolicLink())
      .map((entry) => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? walkFiles(root, full) : [full];
      }),
  );
  return nested.flat();
};

const readFolderMod = async (dir) => {
  const files = await walkFiles(dir);
  let total = 0;
  const read = [];
  for (const file of files) {
    const data = await fs.readFile(file);
    total += data.length;
    if (total > MAX_MOD_BYTES) throw new Error('Mod is too large.');
    read.push({
      path: path.relative(dir, file).split(path.sep).join('/'),
      data: new Uint8Array(data),
    });
  }
  return { files: read };
};

const readMod = async (_event, name) => {
  const target = modPath(name);
  const stat = await fs.stat(target);
  if (stat.isDirectory()) return readFolderMod(target);
  if (stat.size > MAX_MOD_BYTES) throw new Error('Mod is too large.');
  return { zip: new Uint8Array(await fs.readFile(target)) };
};

const openModsFolder = async () => {
  await fs.mkdir(modsDir(), { recursive: true });
  const error = await shell.openPath(modsDir());
  if (error) coreLog().warn('Mods', 'Could not open mods folder', error);
  return !error;
};

const logged =
  (name, handler) =>
  async (...args) => {
    try {
      return await handler(...args);
    } catch (e) {
      coreLog().error('Mods', `${name} failed`, e);
      throw e;
    }
  };

const registerModHandlers = () => {
  coreLog().info('Mods', `mods at ${modsDir()}`);
  ipcMain.handle('mods:list', logged('list', listMods));
  ipcMain.handle('mods:read', logged('read', readMod));
  ipcMain.handle('mods:open-folder', logged('open-folder', openModsFolder));
};

module.exports = { registerModHandlers };
