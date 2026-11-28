/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  contentRefsOf,
  contentRefsRewrite,
} from '@helpers/content/content-refs';
import { sortBy } from 'es-toolkit/compat';
import fs from 'fs-extra';
import * as yaml from 'js-yaml';
import path from 'path';
import rec from 'recursive-readdir';
import { CONTENT_OUT_DIR } from './content-out-dir';
import { demoFilterContent } from './demo-content';
import { buildI18n, writeI18n } from './gamedata-i18n';
import { I18N_DIR } from './i18n-dir';
import { writeJsonIfChanged } from './write-json-if-changed';

fs.ensureDirSync(CONTENT_OUT_DIR);

const allData: Record<string, any[]> = {};
const trackedIds: Record<string, boolean> = {};
const trackedNames: Record<string, boolean> = {};
const idToName: Record<string, Record<string, string>> = {};
const fileOf = new Map<any, string>();

// preload
const processFiles = async () => {
  const allFiles = sortBy(fs.readdirSync('gamedata')).filter(
    (folder: string) => folder !== I18N_DIR,
  );

  // Read concurrently but process in sorted order, so output is stable across rebuilds.
  const filesPerFolder = await Promise.all(
    allFiles.map((folder: string) => rec(`gamedata/${folder}`)),
  );

  allFiles.forEach((folder: string, i: number) => {
    sortBy(filesPerFolder[i]).forEach((file: string) => {
      try {
        const doc = yaml.load(fs.readFileSync(file, 'utf-8')) as any[];

        idToName[folder] ??= {};
        allData[folder] ??= [];
        allData[folder].push(...doc);

        doc.forEach((entry: any) => {
          fileOf.set(entry, path.relative('gamedata', file));
          if (!entry.name) {
            console.error(`Entry "${entry.id}" has no name.`);
            return;
          }

          if (trackedNames[entry.name]) {
            console.error(
              `Name "${entry.name}" already exists somewhere in the content.`,
            );
            process.exit(1);
          }

          if (trackedIds[entry.id]) {
            console.error(
              `Id "${entry.id}" already exists somewhere in the content.`,
            );
            process.exit(1);
          }

          trackedIds[entry.id] = true;
          trackedNames[entry.name] = true;
          idToName[folder][entry.name] = entry.id;
        });

        // console.log(`Loaded ${folder}/${file} - ${doc.length} entries...`);
      } catch (e) {
        console.error(e);
      }
    });
  });

  console.log(
    `Loaded ${allFiles.length} files - ${Object.keys(trackedIds).length} entries...`,
  );
};

const contentTypes = () => Object.keys(allData);

const refsOf = (entry: any) => contentRefsOf(entry, contentTypes());

const getIdForName = (name: string, type: string) => {
  const res = idToName[type][name];
  if (!res) {
    console.log(new Error().stack);
    console.error(`Name ${name} (${type}) has no corresponding id.`);
    process.exit(1);
  }

  return res;
};

const rewriteDataIds = () => {
  const allIds = Object.keys(allData).reverse();
  console.log(`Valid identifiers: ${allIds.join(', ')}`);

  allIds.forEach((key) => {
    Object.values(allData[key]).forEach((entry) => {
      delete entry.demoStrip;
      contentRefsRewrite(entry, contentTypes(), getIdForName);
    });
  });

  // write
  allIds.forEach((key) => {
    writeJsonIfChanged(`${CONTENT_OUT_DIR}/${key}.json`, allData[key]);
  });

  writeJsonIfChanged(`${CONTENT_OUT_DIR}/all.json`, allData);
};

const run = async () => {
  await processFiles();
  const languages = await buildI18n(allData);
  if (process.argv.includes('--demo')) {
    demoFilterContent(allData, fileOf, refsOf);
  }
  writeI18n(languages, allData);
  rewriteDataIds();
};

run();
