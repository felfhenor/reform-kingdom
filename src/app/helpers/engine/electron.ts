import type {
  ElectronWindowBridge,
  WindowWithElectronWindowBridge,
} from '@interfaces';

export function isInElectron() {
  return navigator.userAgent.toLowerCase().includes(' electron/');
}

// Partial since a desktop build older than these handlers still exposes the savefile bridge.
export function electronWindowBridge():
  Partial<ElectronWindowBridge> | undefined {
  return (window as WindowWithElectronWindowBridge).reformElectron;
}
