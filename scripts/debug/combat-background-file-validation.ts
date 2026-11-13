// Fails if COMBAT_BACKGROUNDS and public/asset/combatbg/*.png drift apart.

import { COMBAT_BACKGROUNDS } from '@interfaces/combat-background';
import fs from 'fs-extra';
import path from 'path';

const COMBATBG_DIR = path.resolve(
  __dirname,
  '..',
  '..',
  'public',
  'asset',
  'combatbg',
);

export async function runCombatBackgroundFileValidation(): Promise<string[]> {
  const files = (await fs.readdir(COMBATBG_DIR))
    .filter((file) => file.endsWith('.png'))
    .map((file) => file.replace(/\.png$/, ''));
  const listed: readonly string[] = COMBAT_BACKGROUNDS;

  return [
    ...listed
      .filter((name) => !files.includes(name))
      .map((name) => `[combatbackgrounds] ${name} has no ${name}.png.`),
    ...files
      .filter((name) => !listed.includes(name))
      .map(
        (name) =>
          `[combatbackgrounds] ${name}.png is not in COMBAT_BACKGROUNDS.`,
      ),
  ];
}
