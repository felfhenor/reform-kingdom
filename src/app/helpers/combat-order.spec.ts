import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/rng', () => ({
  rngUuid: vi.fn(() => 'clause-1'),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

import {
  COMBAT_ORDER_ROW_CAP,
  combatOrderClauseAdd,
  combatOrderClauseRemove,
  combatOrderClauseReorder,
  combatOrderClauseSetEnabled,
  combatOrderClauseSummary,
  combatOrderClauseUpdate,
  combatOrderClauses,
} from '@helpers/combat-order';
import { gamestate, updateGamestate } from '@helpers/state-game';
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

function applyLastUpdate(state: GameState): GameState {
  const calls = vi.mocked(updateGamestate).mock.calls;
  const updateFn = calls[calls.length - 1][0];
  return updateFn(state);
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

describe('combatOrderClauseAdd', () => {
  it('prepends a new enabled clause and returns true', () => {
    vi.mocked(gamestate).mockReturnValue(stateWithParty([buildCharacter()]));

    const added = combatOrderClauseAdd(
      characterId,
      jobId,
      { type: 'Always' },
      {
        type: 'RandomSkill',
      },
    );

    expect(added).toBe(true);

    const result = applyLastUpdate(stateWithParty([buildCharacter()]));
    expect(result.world.party[0].combatOrders[jobId]).toEqual([
      {
        id: 'clause-1',
        enabled: true,
        condition: { type: 'Always' },
        action: { type: 'RandomSkill' },
      },
    ]);
  });

  it('places the new clause ahead of existing clauses', () => {
    const existing = buildClause({ id: 'clause-0' as CombatOrderClauseId });
    vi.mocked(gamestate).mockReturnValue(
      stateWithParty([
        buildCharacter({ combatOrders: { [jobId]: [existing] } }),
      ]),
    );

    combatOrderClauseAdd(
      characterId,
      jobId,
      { type: 'Always' },
      { type: 'RandomSkill' },
    );

    const result = applyLastUpdate(
      stateWithParty([
        buildCharacter({ combatOrders: { [jobId]: [existing] } }),
      ]),
    );
    expect(result.world.party[0].combatOrders[jobId]).toHaveLength(2);
    expect(result.world.party[0].combatOrders[jobId][1]).toBe(existing);
  });

  it('refuses to add past the row cap and returns false', () => {
    const fullClauses = Array.from({ length: COMBAT_ORDER_ROW_CAP }, (_, i) =>
      buildClause({ id: `clause-${i}` as CombatOrderClauseId }),
    );
    vi.mocked(gamestate).mockReturnValue(
      stateWithParty([
        buildCharacter({ combatOrders: { [jobId]: fullClauses } }),
      ]),
    );

    const added = combatOrderClauseAdd(
      characterId,
      jobId,
      { type: 'Always' },
      {
        type: 'RandomSkill',
      },
    );

    expect(added).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });
});

describe('combatOrderClauseUpdate', () => {
  it('replaces the condition/action of the matching clause, keeping id and enabled', () => {
    const existing = buildClause({ enabled: false });
    vi.mocked(gamestate).mockReturnValue(stateWithParty([]));

    combatOrderClauseUpdate(
      characterId,
      jobId,
      existing.id,
      { type: 'EnemyCount', comparator: 'GreaterThanOrEqual', count: 3 },
      { type: 'CastSkillFamily', family: 'Fireball' },
    );

    const result = applyLastUpdate(
      stateWithParty([
        buildCharacter({ combatOrders: { [jobId]: [existing] } }),
      ]),
    );

    expect(result.world.party[0].combatOrders[jobId]).toEqual([
      {
        id: existing.id,
        enabled: false,
        condition: {
          type: 'EnemyCount',
          comparator: 'GreaterThanOrEqual',
          count: 3,
        },
        action: { type: 'CastSkillFamily', family: 'Fireball' },
      },
    ]);
  });
});

describe('combatOrderClauseRemove', () => {
  it('removes only the matching clause', () => {
    const keep = buildClause({ id: 'keep' as CombatOrderClauseId });
    const remove = buildClause({ id: 'remove' as CombatOrderClauseId });
    vi.mocked(gamestate).mockReturnValue(stateWithParty([]));

    combatOrderClauseRemove(characterId, jobId, remove.id);

    const result = applyLastUpdate(
      stateWithParty([
        buildCharacter({ combatOrders: { [jobId]: [keep, remove] } }),
      ]),
    );

    expect(result.world.party[0].combatOrders[jobId]).toEqual([keep]);
  });
});

describe('combatOrderClauseSetEnabled', () => {
  it('flips only the enabled flag of the matching clause', () => {
    const clause = buildClause({ enabled: true });
    vi.mocked(gamestate).mockReturnValue(stateWithParty([]));

    combatOrderClauseSetEnabled(characterId, jobId, clause.id, false);

    const result = applyLastUpdate(
      stateWithParty([buildCharacter({ combatOrders: { [jobId]: [clause] } })]),
    );

    expect(result.world.party[0].combatOrders[jobId]).toEqual([
      { ...clause, enabled: false },
    ]);
  });
});

describe('combatOrderClauseReorder', () => {
  it('moves a clause from previousIndex to newIndex', () => {
    const first = buildClause({ id: 'first' as CombatOrderClauseId });
    const second = buildClause({ id: 'second' as CombatOrderClauseId });
    const third = buildClause({ id: 'third' as CombatOrderClauseId });
    vi.mocked(gamestate).mockReturnValue(stateWithParty([]));

    combatOrderClauseReorder(characterId, jobId, 0, 2);

    const result = applyLastUpdate(
      stateWithParty([
        buildCharacter({
          combatOrders: { [jobId]: [first, second, third] },
        }),
      ]),
    );

    expect(result.world.party[0].combatOrders[jobId]?.map((c) => c.id)).toEqual(
      ['second', 'third', 'first'],
    );
  });

  it('leaves the list unchanged when previousIndex is out of range', () => {
    const only = buildClause();
    vi.mocked(gamestate).mockReturnValue(stateWithParty([]));

    combatOrderClauseReorder(characterId, jobId, 5, 0);

    const result = applyLastUpdate(
      stateWithParty([buildCharacter({ combatOrders: { [jobId]: [only] } })]),
    );

    expect(result.world.party[0].combatOrders[jobId]).toEqual([only]);
  });
});

describe('combatOrderClauseSummary', () => {
  it('describes an unconditional CastSkillFamily clause with default targeting', () => {
    const clause = buildClause({
      condition: { type: 'Always' },
      action: { type: 'CastSkillFamily', family: 'Fireball' },
    });

    expect(combatOrderClauseSummary(clause)).toBe('Cast Fireball (default)');
  });

  it('appends a comparator-based condition description', () => {
    const clause = buildClause({
      condition: {
        type: 'SelfHealthPercent',
        comparator: 'LessThan',
        value: 50,
      },
      action: { type: 'CastSkillFamily', family: 'Cure' },
    });

    expect(combatOrderClauseSummary(clause)).toBe(
      'Cast Cure (default) if my Health < 50%',
    );
  });

  it('describes an ally-count-health condition with its direction', () => {
    const below = buildClause({
      condition: {
        type: 'AllyCountHealthPercent',
        healthDirection: 'Below',
        healthPercent: 50,
        comparator: 'GreaterThanOrEqual',
        count: 1,
      },
      action: { type: 'CastSkillFamily', family: 'Cure' },
    });
    const above = buildClause({
      ...below,
      condition: { ...below.condition, healthDirection: 'Above' } as never,
      action: { type: 'CastSkillFamily', family: 'Attack' },
    });

    expect(combatOrderClauseSummary(below)).toBe(
      'Cast Cure (default) if allies below 50% HP >= 1',
    );
    expect(combatOrderClauseSummary(above)).toBe(
      'Cast Attack (default) if allies above 50% HP >= 1',
    );
  });

  it('shows the target-mode override instead of "(default)" when set', () => {
    const weakest = buildClause({
      condition: { type: 'Always' },
      action: {
        type: 'CastSkillFamily',
        family: 'Cure',
        targetMode: 'Weakest',
      },
    });
    const strongest = buildClause({
      condition: { type: 'Always' },
      action: {
        type: 'CastSkillFamily',
        family: 'Attack',
        targetMode: 'Strongest',
      },
    });

    expect(combatOrderClauseSummary(weakest)).toBe('Cast Cure (on lowest HP)');
    expect(combatOrderClauseSummary(strongest)).toBe(
      'Cast Attack (on highest HP)',
    );
  });

  it('describes the mandatory RandomSkill action', () => {
    const clause = buildClause({
      condition: { type: 'Always' },
      action: { type: 'RandomSkill' },
    });

    expect(combatOrderClauseSummary(clause)).toBe('Use a random skill');
  });
});
