import type * as Helpers from '@helpers';
import type { GameOptions } from '@interfaces';
import type { BrowserContext, Page } from 'playwright';

export type TrailerApi = typeof Helpers;

export type TrailerMode = 'draft' | 'final';

export type TrailerRunOptions = {
  mode: TrailerMode;
  hold: boolean;
};

export type TrailerShotOptions = {
  game?: Partial<
    Pick<GameOptions, 'mapZoom' | 'debugTickMultiplier' | 'adventureLogOverlay'>
  >;
  hideToasts?: boolean;
  hideSelectors?: string[];
  css?: string;
};

export type TrailerPageFn<A, R> = (api: TrailerApi, arg: A) => R;

export type TrailerContext = {
  page: Page;
  evaluate: <R, A = undefined>(
    fn: TrailerPageFn<A, R | Promise<R>>,
    arg?: A,
  ) => Promise<R>;
  // Sync predicates only: Playwright treats a returned Promise as already truthy.
  until: <A = undefined>(
    fn: TrailerPageFn<A, boolean>,
    arg?: A,
    timeoutMs?: number,
  ) => Promise<void>;
  wait: (ms: number) => Promise<void>;
  teleport: (nodeName: string) => Promise<void>;
  // Full page load, so only for leaving the game screen (e.g. the title screen).
  navigate: (routePath: string) => Promise<void>;
  log: (marker: string) => void;
  clockReset: () => void;
};

export type TrailerShot = {
  name: string;
  description: string;
  options?: TrailerShotOptions;
  setup: (t: TrailerContext) => Promise<void>;
  action: (t: TrailerContext) => Promise<void>;
};

export type TrailerBrowser = {
  context: BrowserContext;
  page: Page;
  profileDir: string;
  videoDir?: string;
  launchedAt: number;
};

export type ObsConnectionConfig = {
  url: string;
  password?: string;
};

export type ObsWebsocketConfigFile = {
  server_enabled?: boolean;
  server_port?: number;
  auth_required?: boolean;
  server_password?: string;
};

export type ObsRestoreState = {
  scene: string;
  recordDirectory: string;
};
