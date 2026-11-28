import {
  contentSnapshotBase,
  getEntriesByType,
} from '@helpers/content/content';
import { i18nValidate } from '@helpers/i18n/i18n-validate';
import { baseTilesetGet, mapsSnapshotBase } from '@helpers/maps';
import { modsApply, modsApplyErrors } from '@helpers/mod/mod-apply';
import { modBundleParse } from '@helpers/mod/mod-bundle';
import type {
  ContentType,
  I18nLanguageData,
  IsContentItem,
  TiledMap,
} from '@interfaces';
import fs from 'fs-extra';
import * as yaml from 'js-yaml';
import { loadCompiledContentFromDisk } from './debug/load-compiled-content';
import { i18nTiledObjectNames } from '@helpers/i18n/i18n-fields';
import { modDirFiles, modDirs } from './mods-files';

const io = {
  toUrl: (file: { path: string }) => `blob:${file.path}`,
  parseYaml: (text: string) => yaml.load(text),
  baseTileset: baseTilesetGet,
};

const englishLanguage = (): I18nLanguageData =>
  fs.readJsonSync('public/json/i18n/en.json');

const mapNodeNames = (): string[] =>
  Object.values(
    fs.readJsonSync('public/json/all-maps.json') as Record<string, TiledMap>,
  ).flatMap(i18nTiledObjectNames);

// Unknown lines only warn, since a translation can outlive content a game update removed.
const validateTranslations = (translations: I18nLanguageData): string[] => {
  const { errors, warnings } = i18nValidate(
    translations,
    englishLanguage().ui,
    (type, name) =>
      getEntriesByType<IsContentItem>(type as ContentType).find(
        (entry) => entry.name === name,
      ) as Record<string, unknown> | undefined,
    mapNodeNames(),
  );
  warnings.forEach((warning) => console.log(`  ~ ${warning}`));
  return errors;
};

const validate = async (name: string): Promise<string[]> => {
  const { bundle, errors } = modBundleParse(await modDirFiles(name), io);
  if (!bundle || errors.length > 0) return errors;
  if (bundle.translations) return validateTranslations(bundle.translations);
  return modsApplyErrors(modsApply([bundle]));
};

const run = async () => {
  loadCompiledContentFromDisk();
  contentSnapshotBase();
  mapsSnapshotBase();

  let failed = false;
  for (const name of modDirs(process.argv[2])) {
    console.log(`${name}:`);
    const errors = await validate(name);
    failed ||= errors.length > 0;
    if (errors.length === 0) console.log('  OK');
    errors.forEach((error) => console.log(`  - ${error}`));
  }
  if (failed) process.exit(1);
};

run();
