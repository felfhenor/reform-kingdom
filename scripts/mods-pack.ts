import { Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from '@zip.js/zip.js';
import fs from 'fs-extra';
import path from 'path';
import { modDirFiles, modDirs } from './mods-files';

const OUT_DIR = path.resolve('dist/mods');

const pack = async (name: string) => {
  const writer = new ZipWriter(new Uint8ArrayWriter());
  for (const file of await modDirFiles(name)) {
    await writer.add(file.path, new Uint8ArrayReader(file.data));
  }
  const zip = await writer.close();
  fs.writeFileSync(path.join(OUT_DIR, `${name}.zip`), zip);
  console.log(`Packed ${name} -> dist/mods/${name}.zip`);
};

const run = async () => {
  fs.ensureDirSync(OUT_DIR);
  for (const name of modDirs(process.argv[2])) await pack(name);
};

run();
