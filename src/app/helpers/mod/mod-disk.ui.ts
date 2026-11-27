import { modsDiskBridge } from '@helpers/mod/mod-disk';

export function modsDiskAvailable(): boolean {
  return !!modsDiskBridge()?.modsList;
}

export async function modsDiskOpenFolder(): Promise<boolean> {
  return (await modsDiskBridge()?.modsOpenFolder?.()) ?? false;
}
