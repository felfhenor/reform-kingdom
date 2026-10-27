export function isInElectron() {
  return navigator.userAgent.toLowerCase().includes(' electron/');
}
