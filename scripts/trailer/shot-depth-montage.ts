import type { KingdomSubview } from '@interfaces';
import { shotClick, shotShowpieceRow, shotWorldPrepare } from './shot-common';
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
// The workshop keeps its selection in component state, so it's picked through real clicks.
async function workshopItemSelect(t: TrailerContext): Promise<void> {
  const picker = t.page.locator('app-panel-equipment-picker');
  await picker.locator('button:has(app-row-hero-summary)').first().click();

  const showpiece = await shotShowpieceRow(picker);
  if (!showpiece) throw new Error('The first hero has no blue or purple gear.');
  await shotClick(t, showpiece);
}

async function workshopReforgeShow(t: TrailerContext): Promise<void> {
  await shotClick(t, t.page.getByRole('tab', { name: 'Reforge' }));
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
