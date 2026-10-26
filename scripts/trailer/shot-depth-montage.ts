import type { KingdomSubview } from '@interfaces';
import { shotWorldPrepare } from './shot-common';
import type { TrailerContext, TrailerShot } from './types';

const START_NODE = 'Slimed Waystation';
const VIEW_HOLD_MS = 2_000;
// Hard cuts in the editor, so each view only needs to hold long enough to read.
const KINGDOM_VIEWS: KingdomSubview[] = [
  'armory',
  'workshop',
  'museum',
  'bestiary',
  'astralprojector',
  'workers',
  'tradeskill-blacksmithing',
];
// Purple first, then blue, so the workshop opens on a showpiece item.
const WORKSHOP_RARITIES = ['Mystical', 'Rare'];
// Parks the cursor off any control so no hover highlight lingers on camera.
const MOUSE_PARK = { x: 1_919, y: 1_079 };

// The workshop keeps its selection in component state, so it's picked through real clicks.
async function workshopItemSelect(t: TrailerContext): Promise<void> {
  const picker = t.page.locator('app-panel-equipment-picker');
  await picker.locator('button:has(app-row-hero-summary)').first().click();

  const rows = WORKSHOP_RARITIES.map((rarity) =>
    picker.locator(
      `button:not([aria-disabled="true"]):has(.outline-${rarity})`,
    ),
  );
  // count() doesn't wait, and the equipped list renders a frame after the hero click.
  await rows[0].or(rows[1]).first().waitFor();
  const counts = await Promise.all(rows.map((row) => row.count()));
  const showpiece = rows.find((_, index) => counts[index] > 0);
  if (!showpiece) throw new Error('The first hero has no blue or purple gear.');

  await showpiece.first().click();
  await t.page.mouse.move(MOUSE_PARK.x, MOUSE_PARK.y);
}

async function workshopReforgeShow(t: TrailerContext): Promise<void> {
  await t.page.getByRole('tab', { name: 'Reforge' }).click();
  await t.page.mouse.move(MOUSE_PARK.x, MOUSE_PARK.y);
}

export const depthMontageShot: TrailerShot = {
  name: 'depth-montage',
  description: 'Quick holds on the heroes, skill tree and kingdom views.',
  options: { hideToasts: true },

  async setup(t) {
    await shotWorldPrepare(t, START_NODE);
    await t.evaluate((api) => {
      api.heroesSubviewClear();
      api.setGamePlayView('heroes');
    });
  },

  async action(t) {
    t.log('heroes');
    await t.wait(VIEW_HOLD_MS);

    await t.evaluate((api) => {
      const firstHero = api.worldPartyState()[0];
      if (firstHero) api.skillTreePageOpen(firstHero.id);
    });
    t.log('skill tree');
    await t.wait(VIEW_HOLD_MS);

    await t.evaluate((api) => api.setGamePlayView('kingdom'));
    for (const view of KINGDOM_VIEWS) {
      await t.evaluate((api, subview) => api.kingdomSubviewShow(subview), view);
      if (view === 'workshop') {
        await workshopItemSelect(t);
        t.log('workshop infuse');
        await t.wait(VIEW_HOLD_MS);
        await workshopReforgeShow(t);
      }
      t.log(view);
      await t.wait(VIEW_HOLD_MS);
    }
  },
};
