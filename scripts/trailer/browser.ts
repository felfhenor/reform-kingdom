import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import type { BrowserContext, Page } from 'playwright';
import { chromium } from 'playwright';
import type {
  TrailerApi,
  TrailerBrowser,
  TrailerContext,
  TrailerMode,
  TrailerPageFn,
  TrailerShotOptions,
} from './types';

export const GAME_URL = 'http://localhost:9766';
export const CAPTURE_TITLE = 're:Form Trailer Capture';

export const CAPTURE_WIDTH = 1920;
export const CAPTURE_HEIGHT = 1080;
const BOOT_TIMEOUT_MS = 60_000;
const STEP_TIMEOUT_MS = 15_000;

// Page functions are sent as source so they can receive `window.api` as a typed argument.
function pageCall<A, R>(fn: TrailerPageFn<A, R>, arg: A): string {
  return `(${fn.toString()})(window.api, ${JSON.stringify(arg) ?? 'undefined'})`;
}

async function pageEvaluate<R, A>(
  page: Page,
  fn: TrailerPageFn<A, R | Promise<R>>,
  arg: A,
): Promise<R> {
  return (await page.evaluate(pageCall(fn, arg))) as R;
}

async function pageUntil<A>(
  page: Page,
  fn: TrailerPageFn<A, boolean>,
  arg: A,
  timeoutMs = STEP_TIMEOUT_MS,
): Promise<void> {
  await page.waitForFunction(pageCall(fn, arg), undefined, {
    timeout: timeoutMs,
  });
}

async function gamePageFind(context: BrowserContext): Promise<Page> {
  const deadline = Date.now() + STEP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const page = context.pages().find((p) => p.url().startsWith(GAME_URL));
    if (page) return page;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`No browser window opened ${GAME_URL}.`);
}

// --window-size sets the outer size, so grow the window by whatever the title bar takes.
async function windowClientAreaFit(
  context: BrowserContext,
  page: Page,
): Promise<void> {
  const cdp = await context.newCDPSession(page);
  const { windowId, bounds } = await cdp.send('Browser.getWindowForTarget');
  const inner = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  await cdp.send('Browser.setWindowBounds', {
    windowId,
    bounds: {
      width: (bounds.width ?? CAPTURE_WIDTH) + CAPTURE_WIDTH - inner.width,
      height: (bounds.height ?? CAPTURE_HEIGHT) + CAPTURE_HEIGHT - inner.height,
    },
  });

  await page
    .waitForFunction(
      ([width, height]) =>
        window.innerWidth === width && window.innerHeight === height,
      [CAPTURE_WIDTH, CAPTURE_HEIGHT],
      { timeout: 5_000 },
    )
    .catch(async () => {
      const actual = await page.evaluate(
        () => `${window.innerWidth}x${window.innerHeight}`,
      );
      throw new Error(
        `Window client area is ${actual}, expected ${CAPTURE_WIDTH}x${CAPTURE_HEIGHT}.`,
      );
    });
}

export async function trailerBrowserLaunch(
  mode: TrailerMode,
): Promise<TrailerBrowser> {
  const profileDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'reform-trailer-profile-'),
  );
  const videoDir =
    mode === 'draft'
      ? await fs.mkdtemp(path.join(os.tmpdir(), 'reform-trailer-video-'))
      : undefined;

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    // run.ts restores OBS on Ctrl+C before closing the browser itself.
    handleSIGINT: false,
    viewport: null,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      `--app=${GAME_URL}`,
      `--window-size=${CAPTURE_WIDTH},${CAPTURE_HEIGHT}`,
      '--window-position=0,0',
      '--force-device-scale-factor=1',
    ],
    recordVideo: videoDir
      ? {
          dir: videoDir,
          size: { width: CAPTURE_WIDTH, height: CAPTURE_HEIGHT },
        }
      : undefined,
  });
  // The draft video starts with the page, which launch has just created.
  const launchedAt = Date.now();

  const page = await gamePageFind(context);
  await windowClientAreaFit(context, page);

  return { context, page, profileDir, videoDir, launchedAt };
}

async function optionsApply(
  page: Page,
  gameOptions: TrailerShotOptions['game'] = {},
): Promise<void> {
  await pageEvaluate(
    page,
    (api, shotOptions) => {
      api.setOption('sfxPlay', false);
      api.setOption('bgmPlay', false);
      api.setOption('showDebug', false);
      api.setOption('analyticsEnabled', false);
      api.setOption('analyticsOptInDismissed', true);
      api.setOption('adventureLogOverlay', false);
      Object.entries(shotOptions).forEach(([key, value]) => {
        api.setOption(key as 'mapZoom', value as never);
      });
    },
    gameOptions,
  );
}

// The import's IndexedDB write isn't awaited, so reloading too early would boot an empty save.
async function savefilePersisted(page: Page): Promise<void> {
  const deadline = Date.now() + STEP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const isSetup = await pageEvaluate(
      page,
      async (api) => {
        const state = await api.idbGet<{ meta?: { isSetup?: boolean } }>(
          'gamestate',
        );
        return state?.meta?.isSetup === true;
      },
      undefined,
    );
    if (isSetup) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error('Imported savefile never reached IndexedDB.');
}

export async function trailerGameLoad(
  page: Page,
  savefileJson: string,
  options: TrailerShotOptions,
): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { api?: TrailerApi }).api?.isGameStateReady() ===
      true,
    undefined,
    { timeout: BOOT_TIMEOUT_MS },
  );

  await optionsApply(page, options.game);

  const imported = await pageEvaluate(
    page,
    (api, json) => api.savefileImportJson(json),
    savefileJson,
  );
  if (!imported) throw new Error('The game rejected Savefile.rek.');

  await savefilePersisted(page);

  await page.goto(`${GAME_URL}/game`);
  await page.waitForFunction(
    () =>
      (window as unknown as { api?: TrailerApi }).api?.worldMapReady() === true,
    undefined,
    { timeout: BOOT_TIMEOUT_MS },
  );
  await pageLoaderCleared(page);
  await pageDress(page, options);
}

// The map is ready underneath the global loader before the loader itself clears.
async function pageLoaderCleared(page: Page): Promise<void> {
  await page.waitForSelector('app-screen-loading', {
    state: 'detached',
    timeout: BOOT_TIMEOUT_MS,
  });
}

// Both are lost on every full page load, so they're re-applied after each one.
async function pageDress(
  page: Page,
  options: TrailerShotOptions,
): Promise<void> {
  await page.evaluate((title) => {
    document.title = title;
  }, CAPTURE_TITLE);

  const hiddenSelectors = [
    '.pause-vignette',
    ...(options.hideToasts ? ['.toast-container'] : []),
    ...(options.hideSelectors ?? []),
  ];
  await page.addStyleTag({
    content: `${hiddenSelectors.join(', ')} { display: none !important; }\n${options.css ?? ''}`,
  });
}

export function trailerContextCreate(
  page: Page,
  shotName: string,
  clockStartedAt: number,
  options: TrailerShotOptions,
): TrailerContext {
  let clockStart = clockStartedAt;

  const evaluate: TrailerContext['evaluate'] = (fn, arg) =>
    pageEvaluate(page, fn, arg as never);
  const until: TrailerContext['until'] = (fn, arg, timeoutMs) =>
    pageUntil(page, fn, arg as never, timeoutMs);

  const teleport = async (nodeName: string): Promise<void> => {
    const fromMap = await evaluate(
      (api) => api.worldCurrentLocationState().mapName,
    );
    const toMap = await evaluate(
      (api, name) => api.worldNodeByName(name)?.mapName,
      nodeName,
    );
    if (!toMap) throw new Error(`No world node named "${nodeName}".`);

    await evaluate((api, name) => api.debugTeleportToNode(name), nodeName);
    await until(
      (api, map) => api.worldCurrentLocationState().mapName === map,
      toMap,
    );
    if (fromMap === toMap) return;

    // The map swap resets the camera, so later focus calls must wait for it.
    await until((api) => !api.worldMapReady());
    await until((api) => api.worldMapReady(), undefined, BOOT_TIMEOUT_MS);
  };

  const navigate = async (routePath: string): Promise<void> => {
    await page.goto(`${GAME_URL}${routePath}`);
    await pageLoaderCleared(page);
    await pageDress(page, options);
  };

  return {
    page,
    evaluate,
    until,
    teleport,
    navigate,
    wait: (ms) => page.waitForTimeout(ms),
    log: (marker) => {
      const elapsed = ((Date.now() - clockStart) / 1000).toFixed(1);
      console.log(`[${shotName}] +${elapsed}s ${marker}`);
    },
    clockReset: () => {
      clockStart = Date.now();
    },
  };
}
