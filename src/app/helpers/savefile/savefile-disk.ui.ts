import { savefileDiskBridge } from '@helpers/savefile/savefile-disk';

// False when the desktop build predates the handler, as well as when opening fails.
export async function savefileDiskOpenFolder(): Promise<boolean> {
  return (await savefileDiskBridge()?.savefileOpenFolder?.()) ?? false;
}
