const { app } = require('electron');
const { coreLog } = require('./logging');

const JUMP_LIST_OPEN_SAVES = '--open-saves';
const JUMP_LIST_OPEN_LOGS = '--open-logs';

const JUMP_LIST_TASKS = [
  {
    flag: JUMP_LIST_OPEN_SAVES,
    title: 'Open Save Folder',
    description: 'Open the folder where your save files are.',
  },
  {
    flag: JUMP_LIST_OPEN_LOGS,
    title: 'Open Logs Folder',
    description: 'Open the folder where your log files are.',
  },
];

const jumpListFlag = (argv) =>
  JUMP_LIST_TASKS.find(({ flag }) => argv.includes(flag))?.flag;

// Its own short-lived process, so it works the same whether or not the game is running.
const jumpListRun = (open) =>
  app
    .whenReady()
    .then(open)
    .finally(() => app.exit(0));

// Packaged only: a dev run's exe is the shared electron.exe, which can't take the flags alone.
const jumpListRegister = () => {
  if (process.platform !== 'win32' || !app.isPackaged) return;

  const isSet = app.setUserTasks(
    JUMP_LIST_TASKS.map(({ flag, title, description }) => ({
      program: process.execPath,
      arguments: flag,
      iconPath: process.execPath,
      iconIndex: 0,
      title,
      description,
    })),
  );
  if (!isSet) coreLog().warn('JumpList', 'Could not set jump list tasks');
};

module.exports = {
  JUMP_LIST_OPEN_LOGS,
  JUMP_LIST_OPEN_SAVES,
  jumpListFlag,
  jumpListRegister,
  jumpListRun,
};
