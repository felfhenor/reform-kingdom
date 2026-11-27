import type { Signal } from '@angular/core';
import { signal } from '@angular/core';
import type { ModBundle, ModInstalled, ModRef, ModsFound } from '@interfaces';

const _modsInstalled = signal<ModInstalled[]>([]);
export const modsInstalled: Signal<ModInstalled[]> =
  _modsInstalled.asReadonly();

export function setModsInstalled(mods: ModInstalled[]): void {
  _modsInstalled.set(mods);
}

const _modsAppliedRefs = signal<ModRef[]>([]);
export const modsAppliedRefs: Signal<ModRef[]> = _modsAppliedRefs.asReadonly();

export function setModsAppliedRefs(refs: ModRef[]): void {
  _modsAppliedRefs.set(refs);
}

export function modUsableBundle(id: string): ModBundle | undefined {
  const mod = modsInstalled().find((m) => m.manifest?.id === id);
  return mod?.bundle && mod.errors.length === 0 ? mod.bundle : undefined;
}

export function modsRunOutdated(runMods: ModRef[]): boolean {
  return runMods.some((ref) => {
    const version = modUsableBundle(ref.id)?.manifest.version;
    return version !== undefined && version !== ref.version;
  });
}

// Patch releases don't change the mod format, so only major.minor is compared.
export function modGameVersionMismatch(
  gameVersion?: string,
  current?: string,
): boolean {
  if (!gameVersion || !current) return false;
  const minor = (version: string) =>
    version.replace(/^v/, '').split('.').slice(0, 2).join('.');
  return minor(gameVersion) !== minor(current);
}

export function modsAffectGameplay(mods: ModRef[] | undefined): boolean {
  return (mods ?? []).some((mod) => mod.kind !== 'i18n');
}

export function modRefOf(bundle: ModBundle): ModRef {
  const { id, name, version, kind } = bundle.manifest;
  return { id, name, version, kind };
}

export function modRefLabel(ref: ModRef): string {
  return `${ref.name} (v${ref.version})`;
}

// First copy of a mod id wins, so a folder mod and an imported zip can't both apply.
export function modsDedupe(mods: ModInstalled[]): ModInstalled[] {
  const seen = new Set<string>();
  return mods.map((mod) => {
    const id = mod.manifest?.id;
    if (!id) return mod;
    if (!seen.has(id)) {
      seen.add(id);
      return mod;
    }
    return {
      ...mod,
      bundle: undefined,
      errors: [
        ...mod.errors,
        `Another installed mod already uses the id "${id}".`,
      ],
    };
  });
}

export function modBundleUrls(bundle: ModBundle | undefined): string[] {
  if (!bundle) return [];
  return [
    ...bundle.sprites.map((sprite) => sprite.url),
    ...Object.values(bundle.maps).flatMap((map) =>
      map.tilesets.map((tileset) => tileset.image),
    ),
  ].filter((url) => url.startsWith('blob:'));
}

export function modsFindBundles(refs: ModRef[]): ModsFound {
  const bundles: ModBundle[] = [];
  const missing: ModRef[] = [];
  refs.forEach((ref) => {
    const bundle = modUsableBundle(ref.id);
    if (bundle) bundles.push(bundle);
    else missing.push(ref);
  });
  return { bundles, missing };
}
