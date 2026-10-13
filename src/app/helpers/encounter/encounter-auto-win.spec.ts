import type * as LootHelper from '@helpers/item/loot';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/combat/combat-rewards');
vi.mock('@helpers/commission/commission-kill-progress');
vi.mock('@helpers/decree/auto-mode-state');
vi.mock('@helpers/hero/character-progress');
vi.mock('@helpers/kingdom/bestiary');
vi.mock('@helpers/task/task-progress');
vi.mock('@helpers/item/loot', async (importOriginal) => ({
  ...(await importOriginal<typeof LootHelper>()),
  rollDroppedRewards: vi.fn(),
}));

import { grantResolvedDrops } from '@helpers/combat/combat-rewards';
import { INTIMIDATION_COOLDOWN_TICKS } from '@helpers/config';
import { ensureEncounter } from '@helpers/content/ensure-encounternode';
import { ensureMonster } from '@helpers/content/ensure-monster';
import {
  autoModeRecordClauseSuccess,
  autoModeRecordNodeSuccess,
} from '@helpers/decree/auto-mode-state';
import { encounterTryIntimidate } from '@helpers/encounter/encounter-auto-win';
import {
  partyGainXp,
  syncPartyHpFromCombat,
} from '@helpers/hero/character-progress';
import { rollDroppedRewards } from '@helpers/item/loot';
import { gamestate, worldPartyState } from '@helpers/state-game';
import { taskRecordEncounterClear } from '@helpers/task/task-progress';
import type {
  Character,
  EncounterContent,
  EncounterId,
  ItemId,
  MonsterId,
  ResolvedDrop,
} from '@interfaces';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { abilityJobContent, buildAbilityHero } from '@/testing/job-ability';

const nodeName = 'Field Ruins';
const warriorJob = abilityJobContent('Warrior', [
  ['Intimidation', 1, -15],
  ['Intimidation', 25, -12],
]);
const goblin = ensureMonster({ id: 'goblin' as MonsterId, name: 'Goblin' });
const pelt: ResolvedDrop = {
  kind: 'Item',
  itemId: 'pelt' as ItemId,
  quantity: 1,
} as ResolvedDrop;
const chest: ResolvedDrop = {
  kind: 'Item',
  itemId: 'chest' as ItemId,
  quantity: 1,
} as ResolvedDrop;

function encounter(maxLevel: number): EncounterContent {
  return ensureEncounter({
    id: 'field-ruins' as EncounterId,
    name: nodeName,
    levelRange: { min: 1, max: maxLevel },
    fights: [
      { monsters: [{ monsterId: goblin.id }] },
      { monsters: [{ monsterId: goblin.id }] },
    ],
  } as Partial<EncounterContent>);
}

function seed(
  party: Character[],
  edit: (state: ReturnType<typeof gamestate>) => void = () => undefined,
): void {
  seedGamestate((state) => {
    state.clock.numTicks = 100;
    state.world.party = party;
    edit(state);
  });
}

const tryAt = (content: EncounterContent) =>
  inTick(() => encounterTryIntimidate(content, nodeName));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(partyGainXp).mockReturnValue([]);
  seedContent([goblin, ...warriorJob]);
});

describe('encounterTryIntimidate', () => {
  it("compares the encounter's max level to the Warrior's own level + offset", () => {
    seed([buildAbilityHero('Warrior', 20)]);

    expect(tryAt(encounter(6))).toBe(false);
    expect(tryAt(encounter(5))).toBe(true);
  });

  it('lets a higher rank (-12) at a higher level beat a lower one (-15)', () => {
    seed([buildAbilityHero('Warrior', 20), buildAbilityHero('Warrior', 25)]);

    expect(tryAt(encounter(13))).toBe(true);
  });

  it('is never possible without a Warrior', () => {
    seed([]);

    expect(tryAt(encounter(1))).toBe(false);
  });

  it('blocks a second auto-win until the cooldown has passed', () => {
    seed([buildAbilityHero('Warrior', 30)], (state) => {
      state.world.intimidationLastTick =
        state.clock.numTicks - INTIMIDATION_COOLDOWN_TICKS + 1;
    });
    expect(tryAt(encounter(1))).toBe(false);

    seed([buildAbilityHero('Warrior', 30)], (state) => {
      state.world.intimidationLastTick =
        state.clock.numTicks - INTIMIDATION_COOLDOWN_TICKS;
    });
    expect(tryAt(encounter(1))).toBe(true);
    expect(gamestate().world.intimidationLastTick).toBe(100);
  });

  it('grants every fight its full rewards without touching the party or combat', () => {
    const warrior = buildAbilityHero('Warrior', 30, {}, { hp: 40, ep: 10 });
    seed([warrior]);
    const content = encounter(1);
    seedContent([goblin, content, ...warriorJob]);
    vi.mocked(rollDroppedRewards).mockImplementation((drops) =>
      drops === content.completionRewards ? [chest] : [pelt],
    );

    tryAt(content);

    expect(partyGainXp).toHaveBeenCalledTimes(2);
    expect(
      vi.mocked(grantResolvedDrops).mock.calls.map(([, drops]) => drops),
    ).toEqual([[pelt], [pelt, chest]]);
    expect(taskRecordEncounterClear).toHaveBeenCalledExactlyOnceWith(nodeName);
    expect(autoModeRecordClauseSuccess).toHaveBeenCalledTimes(1);
    expect(autoModeRecordNodeSuccess).toHaveBeenCalledExactlyOnceWith(nodeName);
    expect(syncPartyHpFromCombat).not.toHaveBeenCalled();
    expect(worldPartyState()[0]).toMatchObject({ hp: 40, ep: 10 });
    expect(gamestate().world.combat).toBeUndefined();
  });
});
