import { contentSnapshotBase } from '@helpers/content/content';
import { baseTilesetGet, mapsSnapshotBase } from '@helpers/maps';
import { modsApply, modsApplyErrors } from '@helpers/mod/mod-apply';
import { modBundleParse } from '@helpers/mod/mod-bundle';
import * as yaml from 'js-yaml';
import { loadCompiledContentFromDisk } from './debug/load-compiled-content';
import { modDirFiles, modDirs } from './mods-files';

const io = {
  toUrl: (file: { path: string }) => `blob:${file.path}`,
  parseYaml: (text: string) => yaml.load(text),
  baseTileset: baseTilesetGet,
};

const validate = async (name: string): Promise<string[]> => {
  const { bundle, errors } = modBundleParse(await modDirFiles(name), io);
  if (!bundle || errors.length > 0) return errors;
  return modsApplyErrors(modsApply([bundle]));
};

const run = async () => {
  loadCompiledContentFromDisk();
  contentSnapshotBase();
  mapsSnapshotBase();

  let failed = false;
  for (const name of modDirs(process.argv[2])) {
    const errors = await validate(name);
    failed ||= errors.length > 0;
    console.log(errors.length === 0 ? `${name}: OK` : `${name}:`);
    errors.forEach((error) => console.log(`  - ${error}`));
  }
  if (failed) process.exit(1);
};

run();
