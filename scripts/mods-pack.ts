import fs from 'fs-extra';
import path from 'path';
import { modDirFiles, modDirs, zipModFiles } from './mods-files';

const OUT_DIR = path.resolve('dist/mods');

const pack = async (name: string) => {
  const zip = await zipModFiles(await modDirFiles(name));
  fs.writeFileSync(path.join(OUT_DIR, `${name}.zip`), zip);
  console.log(`Packed ${name} -> dist/mods/${name}.zip`);
};

const run = async () => {
  fs.ensureDirSync(OUT_DIR);
  for (const name of modDirs(process.argv[2])) await pack(name);
};

run();
