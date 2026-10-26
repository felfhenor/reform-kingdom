import fs from 'fs-extra';
import { OBSWebSocket } from 'obs-websocket-js';
import os from 'os';
import path from 'path';
import { CAPTURE_HEIGHT, CAPTURE_TITLE, CAPTURE_WIDTH } from './browser';
import type {
  ObsConnectionConfig,
  ObsRestoreState,
  ObsWebsocketConfigFile,
} from './types';

export const OBS_SCENE = 're:Form Trailer';

const OBS_HOOK_DELAY_MS = 1_500;
const OBS_STOP_TIMEOUT_MS = 30_000;
const OBS_TEMP_RECORD_DIR = path.join(os.tmpdir(), 'reform-trailer-obs');

function obsConfigRead(): ObsConnectionConfig {
  if (process.env['OBS_WEBSOCKET_URL']) {
    return {
      url: process.env['OBS_WEBSOCKET_URL'],
      password: process.env['OBS_WEBSOCKET_PASSWORD'],
    };
  }

  const configPath = path.join(
    process.env['APPDATA'] ?? '',
    'obs-studio/plugin_config/obs-websocket/config.json',
  );
  if (!fs.existsSync(configPath)) {
    throw new Error(`OBS websocket config not found at ${configPath}.`);
  }

  const config = fs.readJsonSync(configPath) as ObsWebsocketConfigFile;
  if (!config.server_enabled) {
    throw new Error(
      'The OBS WebSocket server is disabled. Enable it in OBS: Tools > WebSocket Server Settings.',
    );
  }

  return {
    url: `ws://127.0.0.1:${config.server_port ?? 4455}`,
    password: config.auth_required ? config.server_password : undefined,
  };
}

export async function obsConnect(): Promise<OBSWebSocket> {
  const { url, password } = obsConfigRead();
  const obs = new OBSWebSocket();
  try {
    await obs.connect(url, password);
  } catch (e) {
    throw new Error(
      `Could not connect to OBS at ${url}. Is OBS running? (${String(e)})`,
    );
  }

  const { scenes } = await obs.call('GetSceneList');
  if (!scenes.some((scene) => scene['sceneName'] === OBS_SCENE)) {
    await obs.disconnect();
    throw new Error(
      `OBS has no scene named "${OBS_SCENE}". See scripts/trailer/README.md.`,
    );
  }

  return obs;
}

// Read-only, so the caller holds the restore state before anything in OBS changes.
export async function obsStateCapture(
  obs: OBSWebSocket,
): Promise<ObsRestoreState> {
  const { outputActive } = await obs.call('GetRecordStatus');
  if (outputActive) throw new Error('OBS is already recording.');

  const { currentProgramSceneName } = await obs.call('GetCurrentProgramScene');
  const { recordDirectory } = await obs.call('GetRecordDirectory');
  return { scene: currentProgramSceneName, recordDirectory };
}

// Checked before every change, since a Ctrl+C restore can run while this is still mid-way.
export async function obsRecordStart(
  obs: OBSWebSocket,
  isInterrupted: () => boolean,
): Promise<void> {
  const abortIfInterrupted = (): void => {
    if (isInterrupted()) throw new Error('Interrupted before recording.');
  };

  await fs.ensureDir(OBS_TEMP_RECORD_DIR);
  abortIfInterrupted();
  await obs.call('SetCurrentProgramScene', { sceneName: OBS_SCENE });
  abortIfInterrupted();
  await obs.call('SetRecordDirectory', {
    recordDirectory: OBS_TEMP_RECORD_DIR,
  });

  // The window capture re-hooks each freshly launched browser window.
  await new Promise((resolve) => setTimeout(resolve, OBS_HOOK_DELAY_MS));
  abortIfInterrupted();
  await obsCaptureFrame(obs);
  abortIfInterrupted();
  await obs.call('StartRecord');
}

// Chromium draws its own title bar inside the client area, so it's cropped off by however tall it came out.
async function obsCaptureFrame(obs: OBSWebSocket): Promise<void> {
  const { sceneItems } = await obs.call('GetSceneItemList', {
    sceneName: OBS_SCENE,
  });
  const capture = sceneItems.find(
    (item) => item['inputKind'] === 'window_capture',
  );
  if (!capture) throw new Error(`"${OBS_SCENE}" has no Window Capture.`);

  const sceneItemId = Number(capture['sceneItemId']);
  const { sceneItemTransform } = await obs.call('GetSceneItemTransform', {
    sceneName: OBS_SCENE,
    sceneItemId,
  });
  const sourceWidth = Number(sceneItemTransform['sourceWidth']);
  const sourceHeight = Number(sceneItemTransform['sourceHeight']);
  if (sourceWidth !== CAPTURE_WIDTH || sourceHeight < CAPTURE_HEIGHT) {
    throw new Error(
      `OBS is capturing ${sourceWidth}x${sourceHeight}, not the trailer window. Is another "${CAPTURE_TITLE}" window open?`,
    );
  }

  await obs.call('SetSceneItemTransform', {
    sceneName: OBS_SCENE,
    sceneItemId,
    sceneItemTransform: {
      cropTop: sourceHeight - CAPTURE_HEIGHT,
      cropBottom: 0,
      cropLeft: 0,
      cropRight: 0,
      positionX: 0,
      positionY: 0,
      scaleX: 1,
      scaleY: 1,
      boundsType: 'OBS_BOUNDS_NONE',
    },
  });
}

// Listens before StopRecord is sent, since the stop event can beat the request's own response.
export async function obsRecordStop(
  obs: OBSWebSocket,
  shotName: string,
  outputDir: string,
): Promise<string> {
  let onChange: (event: {
    outputState: string;
    outputPath: string;
  }) => void = () => undefined;
  let timeout: NodeJS.Timeout | undefined;
  const stopped = new Promise<string>((resolve, reject) => {
    onChange = (event) => {
      if (event.outputState === 'OBS_WEBSOCKET_OUTPUT_STOPPED') {
        resolve(event.outputPath);
      }
    };
    timeout = setTimeout(
      () => reject(new Error('OBS never reported the recording as stopped.')),
      OBS_STOP_TIMEOUT_MS,
    );
    obs.on('RecordStateChanged', onChange);
  });

  let recordedPath: string;
  try {
    await obs.call('StopRecord');
    recordedPath = await stopped;
  } finally {
    clearTimeout(timeout);
    obs.off('RecordStateChanged', onChange);
  }

  const finalPath = path.join(
    outputDir,
    `${shotName}${path.extname(recordedPath)}`,
  );
  await fs.ensureDir(outputDir);
  await fs.copy(recordedPath, finalPath, { overwrite: true });
  await fs.remove(recordedPath);

  return finalPath;
}

export async function obsRestore(
  obs: OBSWebSocket,
  restore: ObsRestoreState,
): Promise<void> {
  // Best effort: OBS can still report the output as active while it finalizes a just-stopped file.
  const { outputActive } = await obs.call('GetRecordStatus');
  if (outputActive) await obs.call('StopRecord').catch(() => undefined);

  await obs.call('SetRecordDirectory', {
    recordDirectory: restore.recordDirectory,
  });
  await obs.call('SetCurrentProgramScene', { sceneName: restore.scene });
}
