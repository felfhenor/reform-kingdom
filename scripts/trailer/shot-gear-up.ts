import type { EquipmentSlot } from '@interfaces';
import type { Locator } from 'playwright';
import { shotClick, shotShowpieceRow, shotWorldPrepare } from './shot-common';
import type { TrailerContext, TrailerShot } from './types';

const START_NODE = 'Slimed Waystation';
const SLOT_ORDER: EquipmentSlot[] = [
  'Weapon',
  'Armor',
  'Helmet',
  'Offhand',
  'Ring',
  'Accessory',
  'Artifact',
];
const PICKER_HOLD_MS = 1_200;
const EQUIPPED_HOLD_MS = 3_000;

function slotButton(t: TrailerContext, slot: EquipmentSlot): Locator {
  return t.page.locator(`[data-equip-slot="${slot}"] button`);
}

// Tries each slot off camera, so the recorded click goes straight to one with blue or purple gear waiting.
async function showpieceSlotFind(t: TrailerContext): Promise<EquipmentSlot> {
  const picker = t.page.locator('app-panel-hero-equipment-equipment');
  for (const slot of SLOT_ORDER) {
    const button = slotButton(t, slot);
    if ((await button.count()) === 0) continue;

    await shotClick(t, button);
    const row = await shotShowpieceRow(
      picker.locator('app-card-equipment-item'),
    );
    await shotClick(t, button);
    if (row) return slot;
  }

  throw new Error('No slot has blue or purple gear to equip.');
}

let showpieceSlot: EquipmentSlot | undefined;

export const gearUpShot: TrailerShot = {
  name: 'gear-up',
  description:
    'A hero equips a blue or purple item, which flies into its slot.',
  options: { hideToasts: true },

  async setup(t) {
    await shotWorldPrepare(t, START_NODE);
    await t.evaluate((api) => {
      api.heroesSubviewClear();
      api.setGamePlayView('heroes');
    });
    showpieceSlot = await showpieceSlotFind(t);

    // An empty slot means the equip on camera only ever raises stats.
    await t.evaluate((api, slot) => {
      const hero = api.worldPartyState()[0];
      if (hero) api.characterUnequipToArmory(hero.id, slot);
    }, showpieceSlot);
  },

  async action(t) {
    if (!showpieceSlot) throw new Error('Setup found no slot.');

    await shotClick(t, slotButton(t, showpieceSlot));
    t.log(`${showpieceSlot} picker`);
    await t.wait(PICKER_HOLD_MS);

    const row = await shotShowpieceRow(
      t.page.locator(
        'app-panel-hero-equipment-equipment app-card-equipment-item',
      ),
    );
    if (!row) throw new Error(`The ${showpieceSlot} picker lost its gear.`);
    await shotClick(t, row);
    t.log('equipped');
    await t.wait(EQUIPPED_HOLD_MS);
  },
};
