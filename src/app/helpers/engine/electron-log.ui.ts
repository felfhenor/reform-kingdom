import type { WindowWithElectronLogBridge } from '@interfaces';

// False when the desktop build predates the handler, as well as when opening fails.
export async function electronLogOpenFolder(): Promise<boolean> {
  const bridge = (window as WindowWithElectronLogBridge).reformElectron;
  return (await bridge?.logOpenFolder?.()) ?? false;
}
