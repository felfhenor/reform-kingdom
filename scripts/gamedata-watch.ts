import { spawn } from 'child_process';
import fs from 'fs-extra';
import chokidar from 'chokidar';
import { uniq, intersection } from 'es-toolkit/compat';

let allUsedSpritesheetKeys: string[] = [];

const runCommand = (command: string) =>
  new Promise<void>((resolve) => {
    spawn(command, { stdio: 'inherit', shell: true })
      .on('error', (error) => console.error(error))
      .on('close', () => resolve());
  });

// Editors fire several change events per save; collapse each burst (and any changes mid-build) into one rebuild.
const batched = (task: () => Promise<void>) => {
  let timer: NodeJS.Timeout | undefined;
  let running = false;
  let queued = false;

  const run = async () => {
    if (running) {
      queued = true;
      return;
    }

    running = true;
    await task();
    running = false;

    if (queued) {
      queued = false;
      run();
    }
  };

  return () => {
    clearTimeout(timer);
    timer = setTimeout(run, 300);
  };
};

const rebuildMaps = batched(async () => {
  console.info('[helpers] Rebuilding maps...');
  await runCommand('npm run build:maps');
  console.info('[helpers] Rebuilt maps.');
});

const rebuildGamedata = batched(async () => {
  console.info('[helpers] Rebuilding gamedata...');
  await runCommand('npm run gamedata:build');
  console.info('[helpers] Rebuilt gamedata.');

  const allUsedSprites = getAllUsedSprites();

  if (
    intersection(allUsedSprites, allUsedSpritesheetKeys).length !==
      allUsedSpritesheetKeys.length ||
    allUsedSprites.length !== allUsedSpritesheetKeys.length
  ) {
    console.info('[helpers] Rebuilding art due to new assets...');
    await runCommand('npm run gamedata:art:spritesheets');
    console.info('[helpers] Rebuilt art.');
  }

  allUsedSpritesheetKeys = allUsedSprites;
});

const getAllUsedSprites = () => {
  try {
    const allJsons = fs.readJsonSync('public/json/all.json');

    const allUsedSprites = uniq(
      Object.keys(allJsons)
        .flatMap((key) =>
          allJsons[key].map((entry: any) =>
            entry.sprite ? `gameassets/${key}/${entry.sprite}.png` : undefined,
          ),
        )
        .filter(Boolean),
    );

    return allUsedSprites;
  } catch {
    return [];
  }
};

const startWatch = async () => {
  console.info(`[helpers] Watching gamedata & gamemaps changes...`);
  allUsedSpritesheetKeys = getAllUsedSprites();

  chokidar
    .watch('gamemaps', {
      ignored: (file: string, stats?: { isFile: () => boolean }) =>
        !!(stats?.isFile() && !file.endsWith('.json')),
    })
    .on('change', (name: string) => {
      console.info(`[helpers] ${name} changed.`);
      rebuildMaps();
    });

  chokidar.watch('gamedata').on('change', (name: string) => {
    console.info(`[helpers] ${name} changed.`);
    rebuildGamedata();
  });
};

startWatch();
