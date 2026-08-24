import { signal } from '@angular/core';
import type { VersionInfo } from '@interfaces';

export const localVersion = signal<VersionInfo | undefined>(undefined);
export const liveVersion = signal<VersionInfo | undefined>(undefined);

export function versionInfoToSemver(versionInfo: VersionInfo) {
  if (versionInfo.distance >= 0 && versionInfo.tag) {
    return `${versionInfo.tag} (${versionInfo.raw})`;
  }

  return (
    versionInfo.tag ||
    versionInfo.semverString ||
    versionInfo.raw ||
    versionInfo.hash
  );
}

// Versions static asset URLs (spritesheets, tilesets) so cached image bytes can never
// diverge from a freshly-fetched, cache-busted coordinate/data JSON on the same asset.
export function cacheBustURL(url: string): string {
  const local = localVersion();
  if (!local) return url;

  return `${url}?v=${encodeURIComponent(versionInfoToSemver(local))}`;
}
