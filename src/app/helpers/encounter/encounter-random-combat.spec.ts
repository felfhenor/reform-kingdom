import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/combat/combat-rewards');
vi.mock('@helpers/task/task-progress');

import { combatLog } from '@helpers/combat/combat-log';
import { grantResolvedDrops } from '@helpers/combat/combat-rewards';
import { ensureEncounterRandom } from '@helpers/content/ensure-encounternode';
import { ensureDroppedReward } from '@helpers/content/ensure-helpers-drops';
import { ensureMonster } from '@helpers/content/ensure-monster';
import {
  encounterRandomHandleVictory,
  encounterRandomStartFight,
} from '@helpers/encounter/encounter-random-combat';
import { worldCombatState, worldExploreRandomState } from '@helpers/state-game';
import { taskRecordEncounterClear } from '@helpers/task/task-progress';
import type {
  CollectibleId,
  Combat,
  EncounterRandomFight,
  EncounterRandomId,
  MonsterId,
  ResolvedDrop,
  WorldNodeEntry,
} from '@interfaces';
import { captureAnalyticsEvents } from '@/testing/analytics';
import {
  buildCharacter,
  buildCombat,
  buildMonsterCombatant,
} from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { seedWorldNodes } from '@/testing/world';

const encounterId = 'gobslime-shrine' as EncounterRandomId;
const flowerId = 'gobslime-flower' as CollectibleId;
const levelFlowerId = 'level-flower' as CollectibleId;
const goblin = ensureMonster({ id: 'goblin' as MonsterId, name: 'Goblin' });
const slime = ensureMonster({ id: 'slime' as MonsterId, name: 'Slime' });
const killDrops: ResolvedDrop[] = [
  { kind: 'Item', itemId: 'ore' as never, quantity: 2 },
];

const encounter = ensureEncounterRandom({
  id: encounterId,
  name: 'Gobslime Shrine',
  completionRewards: [
    ensureDroppedReward({ collectibleId: flowerId, chance: 100 }),
    // Only drops at exactly the last fight's level, proving which level rolled the rewards.
    ensureDroppedReward({
      collectibleId: levelFlowerId,
      chance: 100,
      minLevel: 18,
      maxLevel: 18,
    }),
  ],
});

let node: WorldNodeEntry;

function fight(
  level: number,
  ...monsterIds: MonsterId[]
): EncounterRandomFight {
  return { level, monsters: monsterIds.map((monsterId) => ({ monsterId })) };
}

function seedFights(...fights: EncounterRandomFight[]): void {
  seedGamestate((state) => {
    state.world.party = [buildCharacter({ name: 'Ada' })];
    state.world.exploreRandom[encounterId] = {
      fights,
      generatedAtTick: 0,
      completedThisCycle: false,
    };
  });
}

function wonFight(fightIndex: number, level = 12): Combat {
  return buildCombat({
    locationName: node.nodeName,
    encounterRandomId: encounterId,
    fightIndex,
    guardians: [buildMonsterCombatant(goblin, { level })],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  seedContent([encounter, goblin, slime]);
  node = seedWorldNodes([{ name: encounter.name, type: 'ExploreRandomNode' }])[
    encounter.name
  ];
});

describe('encounterRandomStartFight', () => {
  it('starts the generated fight at its level, tagged so a victory can find the next one', () => {
    seedFights(fight(12, goblin.id), fight(18, slime.id, goblin.id));
    const events = captureAnalyticsEvents();

    inTick(() => encounterRandomStartFight(node, 1));

    const combat = worldCombatState();
    expect(combat).toMatchObject({
      locationName: node.nodeName,
      encounterRandomId: encounterId,
      fightIndex: 1,
    });
    expect(combat?.heroes.map((hero) => hero.name)).toEqual(['Ada']);
    expect(
      combat?.guardians.map(({ monsterId, level }) => ({ monsterId, level })),
    ).toEqual([
      { monsterId: slime.id, level: 18 },
      { monsterId: goblin.id, level: 18 },
    ]);
    expect(combatLog()[0].message).toContain('#2');
    expect(events).toEqual(['Combat:Encounter:Random']);
  });

  it('skips monsters no longer in content', () => {
    seedFights(fight(12, 'gone' as MonsterId, goblin.id));

    inTick(() => encounterRandomStartFight(node, 0));

    expect(worldCombatState()?.guardians).toHaveLength(1);
  });

  it('starts nothing for a node without an encounter, or a fight never generated', () => {
    seedFights(fight(12, goblin.id));

    inTick(() => encounterRandomStartFight(node, 1));
    seedContent([goblin]);
    inTick(() => encounterRandomStartFight(node, 0));

    expect(worldCombatState()).toBeUndefined();
  });
});

describe('encounterRandomHandleVictory', () => {
  it('only grants the kill drops for a fight outside any random encounter', () => {
    const combat = buildCombat();

    expect(encounterRandomHandleVictory(combat, killDrops)).toBe(false);

    expect(grantResolvedDrops).toHaveBeenCalledWith(combat, killDrops);
    expect(taskRecordEncounterClear).not.toHaveBeenCalled();
  });

  it('grants the kill drops and moves straight on to the next fight', () => {
    seedFights(fight(12, goblin.id), fight(18, slime.id));
    const combat = wonFight(0);

    expect(inTick(() => encounterRandomHandleVictory(combat, killDrops))).toBe(
      true,
    );

    expect(grantResolvedDrops).toHaveBeenCalledWith(combat, killDrops);
    expect(worldCombatState()).toMatchObject({ fightIndex: 1 });
    expect(worldExploreRandomState()[encounterId].completedThisCycle).toBe(
      false,
    );
  });

  it('lets combat end if the node vanished before the next fight', () => {
    seedFights(fight(12, goblin.id), fight(18, slime.id));
    seedWorldNodes([]);

    expect(
      inTick(() => encounterRandomHandleVictory(wonFight(0), killDrops)),
    ).toBe(false);
    expect(worldCombatState()).toBeUndefined();
  });

  it('grants completion rewards at the fight level and completes the cycle after the last fight', () => {
    seedFights(fight(12, goblin.id), fight(18, slime.id));
    const combat = wonFight(1, 18);
    const events = captureAnalyticsEvents();

    expect(inTick(() => encounterRandomHandleVictory(combat, killDrops))).toBe(
      false,
    );

    expect(grantResolvedDrops).toHaveBeenCalledTimes(1);
    expect(grantResolvedDrops).toHaveBeenCalledWith(combat, [
      ...killDrops,
      { kind: 'Collectible', collectibleId: flowerId },
      { kind: 'Collectible', collectibleId: levelFlowerId },
    ]);
    expect(worldExploreRandomState()[encounterId].completedThisCycle).toBe(
      true,
    );
    expect(taskRecordEncounterClear).toHaveBeenCalledWith(node.nodeName);
    expect(events).toContain('World:Event:Complete:Gobslime Shrine');
  });

  it('still grants the kill drops when the encounter left content mid-cycle', () => {
    seedFights(fight(12, goblin.id));
    seedContent([goblin]);
    const combat = wonFight(0);

    inTick(() => encounterRandomHandleVictory(combat, killDrops));

    expect(grantResolvedDrops).toHaveBeenCalledWith(combat, killDrops);
    expect(worldExploreRandomState()[encounterId].completedThisCycle).toBe(
      false,
    );
  });
});
