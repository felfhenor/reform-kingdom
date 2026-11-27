import { error } from '@helpers/engine/logging';
import type {
  ElectronModsBridge,
  ModDiskRead,
  WindowWithElectronModsBridge,
} from '@interfaces';

// Partial since a desktop shell older than these handlers can load a newer web build.
export function modsDiskBridge(): Partial<ElectronModsBridge> | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as WindowWithElectronModsBridge).reformElectron;
}

export async function modsDiskList(): Promise<string[]> {
  try {
    return (await modsDiskBridge()?.modsList?.()) ?? [];
  } catch (e) {
    error('Mods:Disk', 'Could not list the mods folder.', e);
    return [];
  }
}

export async function modsDiskRead(
  name: string,
): Promise<ModDiskRead | undefined> {
  return modsDiskBridge()?.modsRead?.(name);
}
