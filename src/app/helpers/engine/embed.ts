export function isInIframe(): boolean {
  return window.self !== window.top;
}
