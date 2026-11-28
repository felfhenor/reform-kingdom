import fs from 'fs-extra';
import * as yaml from 'js-yaml';
import path from 'path';
import { i18nTemplateFiles } from './i18n-template';

// Usage: npm run i18n:fill -- <locale>. Adds every missing line to gamedata/i18n/<locale> in English, keeping translated ones.
const locale = process.argv[2];
if (!locale || locale === 'en') {
  console.error(
    'Pass the locale folder to fill, e.g. `npm run i18n:fill -- fr`.',
  );
  process.exit(1);
}

const dir = path.resolve('gamedata/i18n', locale);
const languageFile = path.join(dir, 'language.yml');
if (!fs.existsSync(languageFile)) {
  console.error(
    `${languageFile} is missing; create it with locale and languageName first.`,
  );
  process.exit(1);
}

const readYaml = (file: string): unknown =>
  fs.existsSync(file) ? yaml.load(fs.readFileSync(file, 'utf-8')) : undefined;

const all = fs.readJsonSync('public/json/all.json');
const templates = i18nTemplateFiles(
  readYaml('gamedata/i18n/en/ui.yml'),
  all,
  fs.readJsonSync('public/json/all-maps.json'),
  Object.fromEntries(
    [
      'ui.yml',
      'nodes.yml',
      ...Object.keys(all).map((type) => `content/${type}.yml`),
    ].map((file) => [file, readYaml(path.join(dir, file)) ?? {}]),
  ),
);

Object.entries(templates).forEach(([file, body]) =>
  fs.outputFileSync(path.join(dir, file), body),
);
console.log(`Filled ${Object.keys(templates).length} files in ${dir}`);
