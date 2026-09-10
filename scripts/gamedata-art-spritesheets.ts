/* eslint-disable @typescript-eslint/no-explicit-any */
import { sortBy } from 'es-toolkit/compat';
import fs from 'fs-extra';
import imagemin from 'imagemin';
import webp from 'imagemin-webp';
import { Jimp } from 'jimp';
import rec from 'recursive-readdir';

fs.ensureDirSync('public/art/spritesheets');

const allSpritesheetAtlases: Record<string, any> = {};

const generateSpriteArray = (start: string, frames: number): string[] => {
  return Array(frames)
    .fill(undefined)
    .map((_, i) => (parseInt(start, 10) + i).toString().padStart(4, '0'));
};

const build = async () => {
  const folders = fs.readdirSync('./gameassets');

  for (const sheet of folders) {
    console.log(`Generating spritesheet for ${sheet}...`);

    const files = sortBy(await rec(`./gameassets/${sheet}`));

    let animateContent = undefined;
    let copyFiles: string[] = files;

    const unfilterableSpritesheets = ['hero', 'world-object', 'world-terrain'];

    if (!unfilterableSpritesheets.includes(sheet)) {
      const content = await fs.readJSON(`./public/json/${sheet}.json`, 'utf-8');
      const isAnimated = !!content.find((c: any) => c.frames > 0);
      if (isAnimated) {
        animateContent = content;
      }

      const usedSprites = [
        ...new Set([
          ...content.flatMap((c: any) =>
            c.frames ? generateSpriteArray(c.sprite, c.frames) : [c.sprite],
          ),
        ]),
      ];

      copyFiles = copyFiles.filter((f) =>
        usedSprites.find((s) => f.includes(s)),
      );
    }

    console.log(
      `Found ${copyFiles.length} files for ${sheet} spritesheet (animated=${!!animateContent}).`,
    );

    // since heroes are not like other french girls, we shim the data in
    if (sheet === 'hero') {
      animateContent = Array(files.length / 4)
        .fill(undefined)
        .map((_, i) => ({ sprite: i * 4, frames: 4 }));
    }

    const divisor = animateContent ? 4 : 10;

    await new Promise<void>(async (resolve) => {
      const atlas: Record<
        string,
        { x: number; y: number; width: number; height: number }
      > = {};

      const widthTiles = divisor;
      const heightTiles = Math.ceil(files.length / divisor);

      const spritesheet = new Jimp({
        width: 64 * widthTiles,
        height: 64 * heightTiles,
      });

      for (let i = 0; i < files.length; i++) {
        const x = (i % divisor) * 64;
        const y = Math.floor(i / divisor) * 64;

        const fileName = files[i].replaceAll('\\', '/');

        const spriteRef = await Jimp.read(fileName);

        spritesheet.blit({ src: spriteRef, x, y });

        atlas[fileName] = {
          x,
          y,
          width: 64,
          height: 64,
        };
      }

      await spritesheet.write(`public/art/spritesheets/${sheet}.png`);
      await fs.writeJson(`public/art/spritesheets/${sheet}.json`, atlas);

      allSpritesheetAtlases[sheet] = atlas;

      resolve();
    });
  }

  console.log(`Generating all.json spritesheet atlas.`);
  fs.writeJsonSync('public/art/spritesheets/all.json', allSpritesheetAtlases);
};

const compressImages = async () => {
  await imagemin([`./public/art/spritesheets/*.png`], {
    destination: `./public/art/spritesheets/`,
    plugins: [
      webp({
        lossless: true,
      }),
    ],
  });

  console.log('Done compressing images.');
};

const doBuild = async () => {
  await build();
  await compressImages();
};

doBuild();
