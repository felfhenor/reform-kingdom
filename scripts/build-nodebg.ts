import fs from 'fs-extra';
import imagemin from 'imagemin';
import webp from 'imagemin-webp';

const build = async () => {
  // Renamed or removed PNGs would otherwise leave stale webps behind.
  fs.emptyDirSync('./public/art/nodebg');

  const files = await imagemin(['./public/asset/nodebg/*.png'], {
    destination: './public/art/nodebg/',
    plugins: [webp({ lossless: true })],
  });

  console.log(`Converted ${files.length} node backgrounds to webp.`);
};

build();
