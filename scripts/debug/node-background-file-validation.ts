// Fails if NODE_BACKGROUNDS and public/asset/nodebg/*.png drift apart.

import { NODE_BACKGROUNDS } from '@interfaces/node-background';
import fs from 'fs-extra';
import path from 'path';

const NODEBG_DIR = path.resolve(
  __dirname,
  '..',
  '..',
  'public',
  'asset',
  'nodebg',
);

export async function runNodeBackgroundFileValidation(): Promise<string[]> {
  const files = (await fs.readdir(NODEBG_DIR))
    .filter((file) => file.endsWith('.png'))
    .map((file) => file.replace(/\.png$/, ''));
  const listed: readonly string[] = NODE_BACKGROUNDS;

  return [
    ...listed
      .filter((name) => !files.includes(name))
      .map((name) => `[nodebackgrounds] ${name} has no ${name}.png.`),
    ...files
      .filter((name) => !listed.includes(name))
      .map(
        (name) => `[nodebackgrounds] ${name}.png is not in NODE_BACKGROUNDS.`,
      ),
  ];
}
