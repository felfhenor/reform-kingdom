import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/combat-create', () => ({
  combatCreateForEncounter: vi.fn(),
}));

vi.mock('@helpers/party', () => ({
  partyGet: vi.fn(),
}));

vi.mock('@helpers/rng', () => ({
  rngNumberRange: vi.fn(),
  rngUuid: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  updateGamestate: vi.fn(),
}));

import { combatCreateForEncounter } from '@helpers/combat-create';
import { getEntry } from '@helpers/content';
import { encounterStartFight } from '@helpers/encounter';
import { partyGet } from '@helpers/party';
import { rngNumberRange } from '@helpers/rng';
import { updateGamestate } from '@helpers/state-game';
import type {
  Character,
  Combat,
  CombatId,
  EncounterContent,
  EncounterId,
  GameState,
  MonsterContent,
} from '@interfaces';

describe('encounterStartFight', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds and stores a Combat for the requested fight, tagged with the encounter/fight index', () => {
    const encounter = {
      id: 'enc-1' as EncounterId,
      levelRange: { min: 1, max: 3 },
      fights: [
        { monsters: [{ monsterId: 'Goblin' }] },
        { monsters: [{ monsterId: 'Goblin' }, { monsterId: 'Goblin' }] },
      ],
    } as unknown as EncounterContent;

    const goblin = { id: 'Goblin' } as unknown as MonsterContent;
    const party: Character[] = [];

    vi.mocked(getEntry).mockImplementation((id: string) => {
      if (id === 'enc-1') return encounter as never;
      if (id === 'Goblin') return goblin as never;
      return undefined;
    });
    vi.mocked(partyGet).mockReturnValue(party);
    vi.mocked(rngNumberRange).mockReturnValue(2);

    const builtCombat = {
      id: 'combat-1' as CombatId,
      locationName: 'Field Ruins',
      locationPosition: { x: 0, y: 0 },
      rounds: 0,
      heroes: [],
      guardians: [],
      elementalModifiers: { Fire: 0, Water: 0, Earth: 0, Air: 0 },
    } as unknown as Combat;
    vi.mocked(combatCreateForEncounter).mockReturnValue(builtCombat);

    encounterStartFight('enc-1' as EncounterId, 1, 'Field Ruins');

    expect(combatCreateForEncounter).toHaveBeenCalledWith(
      party,
      [goblin, goblin],
      2,
      'Field Ruins',
    );

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const result = updateFn({ world: {} } as unknown as GameState);
    expect(result.world.combat).toEqual({
      ...builtCombat,
      encounterId: 'enc-1',
      fightIndex: 1,
    });
  });

  it('does nothing when the encounter does not exist', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);

    encounterStartFight('missing' as EncounterId, 0, 'Nowhere');

    expect(combatCreateForEncounter).not.toHaveBeenCalled();
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('does nothing when the requested fight index is out of range', () => {
    const encounter = {
      id: 'enc-1' as EncounterId,
      levelRange: { min: 1, max: 1 },
      fights: [{ monsters: [{ monsterId: 'Goblin' }] }],
    } as unknown as EncounterContent;
    vi.mocked(getEntry).mockReturnValue(encounter as never);

    encounterStartFight('enc-1' as EncounterId, 5, 'Field Ruins');

    expect(combatCreateForEncounter).not.toHaveBeenCalled();
    expect(updateGamestate).not.toHaveBeenCalled();
  });
});
