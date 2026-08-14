import { execSync } from 'child_process';
import fs from 'fs-extra';
import chokidar from 'chokidar';
import { uniq, intersection } from 'es-toolkit/compat';

let allUsedSpritesheetKeys: string[] = [];

const runCommand = (command: string) => {
  try {
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.error(error);
  }
};

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
      console.log(name);
      console.info(`[helpers] ${name} changed. Rebuilding maps...`);

      runCommand('npm run build:maps');
      console.info('[helpers] Rebuilt maps.');
    });

  chokidar.watch('gamedata').on('change', (name: string) => {
    console.info(`[helpers] ${name} changed. Rebuilding gamedata...`);

    runCommand('npm run gamedata:build');
    console.info('[helpers] Rebuilt gamedata.');

    const allUsedSprites = getAllUsedSprites();

    if (
      intersection(allUsedSprites, allUsedSpritesheetKeys).length !==
        allUsedSpritesheetKeys.length ||
      allUsedSprites.length !== allUsedSpritesheetKeys.length
    ) {
      console.info('[helpers] Rebuilding art due to new assets...');
      runCommand('npm run gamedata:art:spritesheets');
      console.info('[helpers] Rebuilt art.');
    }

    allUsedSpritesheetKeys = allUsedSprites;
  });
};

startWatch();
