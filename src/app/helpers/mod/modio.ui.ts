import { environment } from '@environments/environment';
import { isDemoBuild } from '@helpers/demo/demo';
import { localStorageSignal } from '@helpers/engine/signal';
import { modsImportZip } from '@helpers/mod/mod-install.ui';
import type {
  ModioAuth,
  ModioMod,
  ModioPage,
  ModioSearch,
  ModioToken,
} from '@interfaces';

export const MODIO_PAGE_SIZE = 10;

export const modioAuth = localStorageSignal<ModioAuth | undefined>(
  'modioAuth',
  undefined,
);

export function modioIsConfigured(): boolean {
  return !isDemoBuild() && !!environment.modio.apiKey;
}

export function modioIsSignedIn(): boolean {
  const auth = modioAuth();
  return !!auth && auth.expires > Date.now();
}

function modioUrl(path: string, params: Record<string, string> = {}): string {
  const query = new URLSearchParams({
    api_key: environment.modio.apiKey,
    ...params,
  });
  return `${environment.modio.url}${path}?${query.toString()}`;
}

async function modioFetch<T>(
  path: string,
  init: RequestInit = {},
  params: Record<string, string> = {},
): Promise<T> {
  const auth = modioIsSignedIn() ? modioAuth() : undefined;
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    ...(auth ? { Authorization: `Bearer ${auth.token}` } : {}),
  };
  const response = await fetch(modioUrl(path, params), { ...init, headers });
  // A revoked token would otherwise fail every later request, sign-in included.
  if (response.status === 401) modioSignOut();
  if (!response.ok) throw new Error(`mod.io responded ${response.status}.`);
  return response.status === 204 ? (undefined as T) : response.json();
}

export async function modioRequestCode(email: string): Promise<void> {
  await modioFetch('/oauth/emailrequest', {
    method: 'POST',
    body: new URLSearchParams({ email }).toString(),
  });
}

export async function modioExchangeCode(code: string): Promise<void> {
  const result = await modioFetch<ModioToken>('/oauth/emailexchange', {
    method: 'POST',
    body: new URLSearchParams({ security_code: code }).toString(),
  });
  modioAuth.set({
    token: result.access_token,
    expires: result.date_expires * 1000,
  });
}

export function modioSignOut(): void {
  modioAuth.set(undefined);
}

export function modioSearchMods(search: ModioSearch): Promise<ModioPage> {
  return modioFetch(
    `/games/${environment.modio.gameId}/mods`,
    {},
    {
      _limit: String(MODIO_PAGE_SIZE),
      _offset: String(search.offset),
      _sort: search.sort,
      ...(search.query ? { 'name-lk': `*${search.query}*` } : {}),
    },
  );
}

export async function modioSubscribedMods(): Promise<ModioMod[]> {
  const page = await modioFetch<ModioPage>(
    '/me/subscribed',
    {},
    {
      game_id: String(environment.modio.gameId),
    },
  );
  return page.data;
}

function modioSubscription(modId: number, method: 'POST' | 'DELETE') {
  return modioFetch(
    `/games/${environment.modio.gameId}/mods/${modId}/subscribe`,
    { method },
  );
}

// Downloads a fresh copy, since the signed download link expires.
export async function modioInstall(mod: ModioMod): Promise<string[]> {
  const fresh = await modioFetch<ModioMod>(
    `/games/${environment.modio.gameId}/mods/${mod.id}`,
  );
  const response = await fetch(fresh.modfile.download.binary_url);
  if (!response.ok) return [`Download failed (${response.status}).`];

  const errors = await modsImportZip(await response.blob(), mod.id);
  if (errors.length === 0 && modioIsSignedIn()) {
    await modioSubscription(mod.id, 'POST').catch(() => undefined);
  }
  return errors;
}

export async function modioUnsubscribe(modId: number): Promise<void> {
  if (!modioIsSignedIn()) return;
  await modioSubscription(modId, 'DELETE').catch(() => undefined);
}
