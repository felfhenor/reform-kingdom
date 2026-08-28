import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/combat/combat-create', () => ({
  combatCreateForEncounter: vi.fn(),
}));

vi.mock('@helpers/combat/combat-log', () => ({
  combatMessageLog: vi.fn(),
}));

vi.mock('@helpers/combat/combat-rewards', () => ({
  grantResolvedDrops: vi.fn(),
}));

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/encounter/encounter-random', () => ({
  encounterRandomState: vi.fn(),
}));

vi.mock('@helpers/item/loot', () => ({
  rollDroppedRewards: vi.fn(),
}));

vi.mock('@helpers/hero/party', () => ({
  partyGet: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  worldNodeByName: vi.fn(),
  worldNodeEncounterRandom: vi.fn(),
}));

import { combatCreateForEncounter } from '@helpers/combat/combat-create';
import { grantResolvedDrops } from '@helpers/combat/combat-rewards';
import { getEntry } from '@helpers/content';
import { encounterRandomState } from '@helpers/encounter/encounter-random';
import {
  encounterRandomHandleVictory,
  encounterRandomStartFight,
} from '@helpers/encounter/encounter-random-combat';
import { partyGet } from '@helpers/hero/party';
import { rollDroppedRewards } from '@helpers/item/loot';
import { updateGamestate } from '@helpers/state-game';
import {
  worldNodeByName,
  worldNodeEncounterRandom,
} from '@helpers/world-node/world-nodes';
import type {
  Character,
  Combat,
  CombatId,
  EncounterRandomContent,
  EncounterRandomId,
  EncounterRandomNodeState,
  GameState,
  MonsterContent,
  WorldNodeEntry,
} from '@interfaces';

const entry = { nodeName: 'Mystical Gobslime Shrine' } as WorldNodeEntry;
const content = {
  id: 'gobslime-shrine' as EncounterRandomId,
  name: 'Gobslime Shrine',
  completionRewards: [{ collectibleId: 'gobslime-flower', chance: 100 }],
} as unknown as EncounterRandomContent;

describe('encounterRandomStartFight', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds and stores a Combat from the generated fight, tagged with the encounterRandomId/fightIndex', () => {
    vi.mocked(worldNodeEncounterRandom).mockReturnValue(content);
    const goblin = { id: 'Goblin' } as unknown as MonsterContent;
    vi.mocked(getEntry).mockReturnValue(goblin as never);
    vi.mocked(encounterRandomState).mockReturnValue({
      fights: [
        { level: 12, monsters: [{ monsterId: 'Goblin' }] },
        { level: 18, monsters: [{ monsterId: 'Goblin' }] },
      ],
      generatedAtTick: 0,
      completedThisCycle: false,
    } as EncounterRandomNodeState);
    const party: Character[] = [];
    vi.mocked(partyGet).mockReturnValue(party);

    const builtCombat = {
      id: 'combat-1' as CombatId,
      locationName: entry.nodeName,
      locationPosition: { x: 0, y: 0 },
      rounds: 0,
      heroes: [],
      guardians: [],
    } as unknown as Combat;
    vi.mocked(combatCreateForEncounter).mockReturnValue(builtCombat);

    encounterRandomStartFight(entry, 1);

    expect(combatCreateForEncounter).toHaveBeenCalledWith(
      party,
      [goblin],
      18,
      entry.nodeName,
    );

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const result = updateFn({ world: {} } as unknown as GameState);
    expect(result.world.combat).toEqual({
      ...builtCombat,
      encounterRandomId: 'gobslime-shrine',
      fightIndex: 1,
    });
  });

  it('does nothing when there is no content for the node', () => {
    vi.mocked(worldNodeEncounterRandom).mockReturnValue(undefined);

    encounterRandomStartFight(entry, 0);

    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('does nothing when the requested fight index is out of range', () => {
    vi.mocked(worldNodeEncounterRandom).mockReturnValue(content);
    vi.mocked(encounterRandomState).mockReturnValue({
      fights: [{ level: 1, monsters: [] }],
      generatedAtTick: 0,
      completedThisCycle: false,
    } as EncounterRandomNodeState);

    encounterRandomStartFight(entry, 5);

    expect(updateGamestate).not.toHaveBeenCalled();
  });
});

describe('encounterRandomHandleVictory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false when the combat has no encounterRandomId', () => {
    expect(encounterRandomHandleVictory({} as Combat)).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('starts the next generated fight when one remains', () => {
    vi.mocked(encounterRandomState).mockReturnValue({
      fights: [
        { level: 1, monsters: [] },
        { level: 2, monsters: [{ monsterId: 'Goblin' }] },
      ],
      generatedAtTick: 0,
      completedThisCycle: false,
    } as EncounterRandomNodeState);
    vi.mocked(worldNodeByName).mockReturnValue(entry);
    vi.mocked(worldNodeEncounterRandom).mockReturnValue(content);
    vi.mocked(getEntry).mockReturnValue({ id: 'Goblin' } as never);
    vi.mocked(partyGet).mockReturnValue([]);
    vi.mocked(combatCreateForEncounter).mockReturnValue({
      id: 'combat-2' as CombatId,
      locationName: entry.nodeName,
      locationPosition: { x: 0, y: 0 },
      rounds: 0,
      heroes: [],
      guardians: [],
    } as unknown as Combat);

    const combat = {
      encounterRandomId: 'gobslime-shrine' as EncounterRandomId,
      fightIndex: 0,
      locationName: entry.nodeName,
      guardians: [{ level: 12 }],
    } as unknown as Combat;

    expect(encounterRandomHandleVictory(combat)).toBe(true);
    expect(grantResolvedDrops).not.toHaveBeenCalled();
    expect(updateGamestate).toHaveBeenCalledTimes(1);
  });

  it('grants completion rewards and marks the cycle completed once the last fight is won', () => {
    vi.mocked(encounterRandomState).mockReturnValue({
      fights: [{ level: 1, monsters: [] }],
      generatedAtTick: 0,
      completedThisCycle: false,
    } as EncounterRandomNodeState);
    vi.mocked(getEntry).mockReturnValue(content as never);
    vi.mocked(rollDroppedRewards).mockReturnValue([
      { collectibleId: 'gobslime-flower' },
    ] as never);

    const combat = {
      encounterRandomId: 'gobslime-shrine' as EncounterRandomId,
      fightIndex: 0,
      locationName: entry.nodeName,
      guardians: [{ level: 16 }],
    } as unknown as Combat;

    expect(encounterRandomHandleVictory(combat)).toBe(false);

    expect(rollDroppedRewards).toHaveBeenCalledWith(
      content.completionRewards,
      16,
    );
    expect(grantResolvedDrops).toHaveBeenCalledWith(combat, [
      { collectibleId: 'gobslime-flower' },
    ]);

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const result = updateFn({
      world: {
        exploreRandom: {
          'gobslime-shrine': {
            fights: [],
            generatedAtTick: 0,
            completedThisCycle: false,
          },
        },
      },
    } as unknown as GameState);
    expect(
      result.world.exploreRandom['gobslime-shrine'].completedThisCycle,
    ).toBe(true);
  });
});
