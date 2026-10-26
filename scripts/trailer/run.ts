import fs from 'fs-extra';
import type { OBSWebSocket } from 'obs-websocket-js';
import path from 'path';
import readline from 'readline/promises';
import {
  GAME_URL,
  trailerBrowserLaunch,
  trailerContextCreate,
  trailerGameLoad,
} from './browser';
import {
  obsConnect,
  obsRecordStart,
  obsRecordStop,
  obsRestore,
  obsStateCapture,
} from './obs';
import { TRAILER_SHOTS } from './shots';
import type {
  ObsRestoreState,
  TrailerBrowser,
  TrailerRunOptions,
  TrailerShot,
} from './types';

const ENV_PATH = path.join(__dirname, '.env');
const SAVEFILE_PATH = path.join(__dirname, 'Savefile.rek');
const OUTPUT_DIR = path.join(__dirname, 'output');
const RUN_LOCK_PATH = path.join(OUTPUT_DIR, '.run.lock');
const RECORD_PADDING_MS = 1_000;

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// Every run's window shares one title, so a second open window (say, a forgotten --hold) can be what OBS films.
function runLockAcquire(): void {
  const heldBy = fs.existsSync(RUN_LOCK_PATH)
    ? Number(fs.readFileSync(RUN_LOCK_PATH, 'utf8'))
    : undefined;
  if (heldBy && heldBy !== process.pid && isProcessAlive(heldBy)) {
    throw new Error(
      `Another trailer run (pid ${heldBy}) still has a window open. Close it first.`,
    );
  }

  fs.ensureDirSync(OUTPUT_DIR);
  fs.writeFileSync(RUN_LOCK_PATH, String(process.pid));
  process.on('exit', () => fs.removeSync(RUN_LOCK_PATH));
}

async function preflight(): Promise<string> {
  const response = await fetch(GAME_URL).catch(() => undefined);
  if (!response?.ok) {
    throw new Error(`The game isn't reachable at ${GAME_URL}. Run npm start.`);
  }

  if (!fs.existsSync(SAVEFILE_PATH)) {
    throw new Error(`Place a savefile at ${SAVEFILE_PATH}.`);
  }

  return fs.readFile(SAVEFILE_PATH, 'utf8');
}

async function enterPressed(message: string): Promise<void> {
  const prompt = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  await prompt.question(message);
  prompt.close();
}

async function draftVideoSave(
  browser: TrailerBrowser,
  shotName: string,
): Promise<void> {
  const videoPath = await browser.page.video()?.path();
  if (!videoPath || !browser.videoDir) return;

  const draftPath = path.join(OUTPUT_DIR, 'drafts', `${shotName}.webm`);
  await fs.move(videoPath, draftPath, { overwrite: true });
  console.log(`[${shotName}] saved ${draftPath}`);
}

async function shotRun(
  shot: TrailerShot,
  savefileJson: string,
  options: TrailerRunOptions,
  obs?: OBSWebSocket,
): Promise<void> {
  console.log(`[${shot.name}] ${shot.description}`);
  const browser = await trailerBrowserLaunch(options.mode);
  let obsRestoreState: ObsRestoreState | undefined;
  let obsRestoring: Promise<void> | undefined;
  let succeeded = false;
  let interrupted = false;

  // Shared so Ctrl+C and the finally block await one restore instead of racing two.
  const obsCleanup = (): Promise<void> => {
    if (!obs || !obsRestoreState) return Promise.resolve();
    obsRestoring ??= obsRestore(obs, obsRestoreState).catch((e: unknown) => {
      console.error(`[${shot.name}] could not restore OBS: ${String(e)}`);
    });
    return obsRestoring;
  };
  const onInterrupt = (): void => {
    interrupted = true;
    void obsCleanup()
      .then(() => browser.context.close())
      .finally(() => process.exit(130));
  };
  process.once('SIGINT', onInterrupt);

  try {
    await trailerGameLoad(browser.page, savefileJson, shot.options ?? {});
    const t = trailerContextCreate(
      browser.page,
      shot.name,
      browser.launchedAt,
      shot.options ?? {},
    );
    await shot.setup(t);

    if (options.hold) await enterPressed('Holding the window. Press Enter…');

    if (obs && !interrupted) {
      obsRestoreState = await obsStateCapture(obs);
      await obsRecordStart(obs, () => interrupted);
      t.clockReset();
    }

    t.log('recording');
    await t.wait(RECORD_PADDING_MS);
    await shot.action(t);
    await t.wait(RECORD_PADDING_MS);
    t.log('done');

    if (obs) {
      const finalPath = await obsRecordStop(
        obs,
        shot.name,
        path.join(OUTPUT_DIR, 'final'),
      );
      console.log(`[${shot.name}] saved ${finalPath}`);
    }
    succeeded = true;
  } finally {
    await obsCleanup();
    process.off('SIGINT', onInterrupt);
    await browser.context.close().catch(() => undefined);
    if (succeeded && options.mode === 'draft') {
      await draftVideoSave(browser, shot.name);
    }
    if (browser.videoDir) {
      await fs.remove(browser.videoDir).catch(() => undefined);
    }
    await fs.remove(browser.profileDir).catch(() => undefined);
  }
}

function argsParse(argv: string[]): {
  shots: TrailerShot[];
  options: TrailerRunOptions;
} {
  const shotArg = argv.find((arg) => !arg.startsWith('--'));
  const names = TRAILER_SHOTS.map((shot) => shot.name);
  const shots =
    shotArg === 'all'
      ? TRAILER_SHOTS
      : TRAILER_SHOTS.filter((shot) => shot.name === shotArg);

  if (shots.length === 0) {
    throw new Error(
      `Usage: npm run trailer -- <${['all', ...names].join('|')}> [--draft] [--hold]`,
    );
  }

  return {
    shots,
    options: {
      mode: argv.includes('--draft') ? 'draft' : 'final',
      hold: argv.includes('--hold'),
    },
  };
}

async function main(): Promise<void> {
  // Optional local overrides (e.g. OBS_WEBSOCKET_URL); shell variables still win.
  if (fs.existsSync(ENV_PATH)) process.loadEnvFile(ENV_PATH);

  const { shots, options } = argsParse(process.argv.slice(2));
  runLockAcquire();
  const savefileJson = await preflight();
  const obs = options.mode === 'final' ? await obsConnect() : undefined;

  try {
    for (const shot of shots) {
      await shotRun(shot, savefileJson, options, obs);
    }
  } finally {
    await obs?.disconnect();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
