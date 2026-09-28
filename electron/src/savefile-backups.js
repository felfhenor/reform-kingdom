const { app, ipcMain } = require('electron');
const fs = require('fs/promises');
const path = require('path');

// Dev runs share userData with the installed game, so they get their own folder to avoid pruning its backups.
const backupDir = () =>
  path.join(
    app.getPath('userData'),
    app.isPackaged ? 'savefile-backups' : 'savefile-backups-dev',
  );

// Ids come from the renderer, so anything that could escape the backup folder is rejected.
const backupPath = (id) => {
  if (!/^[a-z0-9-]+$/i.test(id)) throw new Error(`Invalid backup id: ${id}`);
  return path.join(backupDir(), `${id}.json`);
};

const listBackupFiles = async () => {
  try {
    const files = await fs.readdir(backupDir());
    return files.filter((file) => file.endsWith('.json'));
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
};

const writeBackup = async (_event, id, json) => {
  const target = backupPath(id);
  await fs.mkdir(backupDir(), { recursive: true });

  // Write-then-rename so a crash mid-write never leaves a truncated backup.
  const temp = `${target}.tmp`;
  await fs.writeFile(temp, json, 'utf8');
  await fs.rename(temp, target);
};

const readAllBackups = async () => {
  const files = await listBackupFiles();
  const contents = await Promise.allSettled(
    files.map((file) => fs.readFile(path.join(backupDir(), file), 'utf8')),
  );

  return contents
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);
};

const pruneBackups = async (_event, keepIds) => {
  const keep = new Set(keepIds.map((id) => `${id}.json`));
  const files = await listBackupFiles();

  await Promise.all(
    files
      .filter((file) => !keep.has(file))
      .map((file) => fs.rm(path.join(backupDir(), file), { force: true })),
  );
};

const registerSavefileBackupHandlers = () => {
  ipcMain.handle('savefile-backup:write', writeBackup);
  ipcMain.handle('savefile-backup:read-all', readAllBackups);
  ipcMain.handle('savefile-backup:prune', pruneBackups);
};

module.exports = { registerSavefileBackupHandlers };
