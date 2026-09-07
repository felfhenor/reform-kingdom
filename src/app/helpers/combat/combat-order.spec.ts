import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
}));

import { combatOrderClauses } from '@helpers/combat/combat-order';
import { gamestate } from '@helpers/state-game';
import type {
  Character,
  CharacterId,
  CombatOrderClause,
  CombatOrderClauseId,
  GameState,
  JobId,
} from '@interfaces';

const characterId = 'char-1' as CharacterId;
const jobId = 'job-1' as JobId;

function buildClause(
  overrides: Partial<CombatOrderClause> = {},
): CombatOrderClause {
  return {
    id: 'clause-1' as CombatOrderClauseId,
    enabled: true,
    condition: { type: 'Always' },
    action: { type: 'RandomSkill' },
    ...overrides,
  };
}

function buildCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: characterId,
    jobId,
    combatOrders: {},
    ...overrides,
  } as Character;
}

function stateWithParty(party: Character[]): GameState {
  return { world: { party } } as unknown as GameState;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('combatOrderClauses', () => {
  it('returns the stored clause list for the given character and job', () => {
    const clauses = [buildClause()];
    vi.mocked(gamestate).mockReturnValue(
      stateWithParty([buildCharacter({ combatOrders: { [jobId]: clauses } })]),
    );

    expect(combatOrderClauses(characterId, jobId)).toBe(clauses);
  });

  it('returns an empty array when the character has no orders for the job', () => {
    vi.mocked(gamestate).mockReturnValue(stateWithParty([buildCharacter()]));

    expect(combatOrderClauses(characterId, jobId)).toEqual([]);
  });

  it('returns an empty array when the character does not exist', () => {
    vi.mocked(gamestate).mockReturnValue(stateWithParty([]));

    expect(combatOrderClauses(characterId, jobId)).toEqual([]);
  });
});
