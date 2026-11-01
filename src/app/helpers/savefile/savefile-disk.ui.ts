import { error } from '@helpers/engine/logging';
import { savefileDiskBridge } from '@helpers/savefile/savefile-disk';
import { saveGameState } from '@helpers/state-game';

// False when the desktop build predates the handler, as well as when opening fails.
export async function savefileDiskOpenFolder(): Promise<boolean> {
  return (await savefileDiskBridge()?.savefileOpenFolder?.()) ?? false;
}

// Saved first so the zip holds the game as it is now; a failed save still exports the last copy on disk.
export async function savefileDiskExportWithLogs(): Promise<boolean> {
  try {
    await saveGameState();
  } catch (e) {
    error('Savefile:Disk', 'Could not save before exporting.', e);
  }
  return (await savefileDiskBridge()?.savefileExportWithLogs?.()) ?? false;
}
