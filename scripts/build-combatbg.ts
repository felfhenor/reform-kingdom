import fs from 'fs-extra';
import imagemin from 'imagemin';
import webp from 'imagemin-webp';

const build = async () => {
  // Renamed or removed PNGs would otherwise leave stale webps behind.
  fs.emptyDirSync('./public/art/combatbg');

  const files = await imagemin(['./public/asset/combatbg/*.png'], {
    destination: './public/art/combatbg/',
    plugins: [webp({ lossless: true })],
  });

  console.log(`Converted ${files.length} combat backgrounds to webp.`);
};

build();
