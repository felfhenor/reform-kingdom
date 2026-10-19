import { beforeEach, describe, expect, it } from 'vitest';

import { ensureEquipment, ensureItem } from '@helpers/content/ensure-item';
import { ensureJob } from '@helpers/content/ensure-job';
import { ensureSkill } from '@helpers/content/ensure-skill';
import { ensureSkillTreeNode } from '@helpers/content/ensure-skilltreenode';
import { defaultEquipment } from '@helpers/defaults';
import {
  stateSkillTreeConfirm,
  stateSkillTreeReset,
} from '@helpers/hero/skill-tree-state';
import { gamestate } from '@helpers/state-game';
import type {
  Character,
  CombatOrderClause,
  CombatOrderClauseId,
  EquipmentId,
  EquipmentSkillId,
  ItemId,
  JobId,
  RegaliaId,
  SkillTreeNodeId,
} from '@interfaces';
import { buildCharacter, buildEquipmentItem } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';
import { buildRegalia } from '@/testing/regalia';

const jobId = 'tree-job' as JobId;
const fluxId = 'memory-flux' as ItemId;
const ids = (...names: string[]) => names as SkillTreeNodeId[];

const strike = ensureSkill({
  id: 'strike' as EquipmentSkillId,
  name: 'Strike',
  family: 'Strike',
});
const strikeBlade = ensureEquipment({
  id: 'strike-blade' as EquipmentId,
  name: 'Strike Blade',
  type: 'Sword',
  grantedSkillIds: [strike.id],
});
const content = [
  ensureJob({ id: jobId, name: 'Job', equippableTypes: ['Sword'] }),
  strikeBlade,
  ensureItem({ id: fluxId, name: 'Memory Flux' }),
  strike,
  ensureSkillTreeNode({
    id: 'strike-node' as SkillTreeNodeId,
    name: 'Job: Strike',
    jobId,
    default: true,
    effects: [{ kind: 'GrantSkill', skillId: strike.id }],
  }),
  ensureSkillTreeNode({
    id: 'might' as SkillTreeNodeId,
    name: 'Job: Might',
    jobId,
    level: 5,
    effects: [{ kind: 'Stat', stat: 'Strength', value: 4 }],
  }),
];

const castStrike: CombatOrderClause = {
  id: 'clause' as CombatOrderClauseId,
  enabled: true,
  condition: { type: 'Always' },
  action: { type: 'CastSkillFamily', family: 'Strike' },
};

function seed(
  options: {
    flux?: number;
    withRegalia?: boolean;
    heroBlade?: boolean;
    regaliaBlade?: boolean;
  } = {},
): Character {
  const { flux = 1, withRegalia = true, heroBlade, regaliaBlade } = options;
  const blade = buildEquipmentItem(strikeBlade.id);
  const hero = buildCharacter({
    jobId,
    level: 5,
    skillTreeNodes: { [jobId]: ids('strike-node') },
    combatOrders: { [jobId]: [castStrike] },
    currentRegaliaIds: withRegalia ? { [jobId]: 'reg' as RegaliaId } : {},
    equipment: { ...defaultEquipment(), Weapon: heroBlade ? blade : undefined },
  });
  seedGamestate((state) => {
    state.world.party = [hero];
    state.materials[fluxId] = { quantity: flux, foundAt: 0 };
    state.regalias.vault = regaliaBlade ? [blade] : [];
    state.regalias.entries = withRegalia
      ? [
          buildRegalia(regaliaBlade ? [blade.id] : [], {
            id: 'reg' as RegaliaId,
            characterId: hero.id,
            jobId,
            combatOrders: [{ ...castStrike }],
            skillTreeNodeIds: ids('strike-node'),
          }),
        ]
      : [];
  });
  return hero;
}

const live = () => gamestate().world.party[0];
const regalia = () => gamestate().regalias.entries[0];

beforeEach(() => seedContent(content));

describe('stateSkillTreeConfirm', () => {
  it('learns valid additions, auto-saves the current regalia and recalculates stats', () => {
    const hero = seed();
    const state = structuredClone(gamestate());

    expect(
      stateSkillTreeConfirm(state, hero.id, ids('strike-node', 'might')),
    ).toBe(jobId);
    expect(state.world.party[0].skillTreeNodes[jobId]).toEqual(
      ids('strike-node', 'might'),
    );
    expect(state.regalias.entries[0].skillTreeNodeIds).toEqual(
      ids('strike-node', 'might'),
    );
    expect(state.world.party[0].stats.Strength).toBe(4);
  });

  it('changes nothing for an invalid confirm', () => {
    const hero = seed();
    const state = structuredClone(gamestate());

    expect(stateSkillTreeConfirm(state, hero.id, [])).toBeUndefined();
    expect(state).toEqual(gamestate());
  });
});

describe('stateSkillTreeReset', () => {
  it('spends a flux, refunds every node and turns off orders for forgotten skills', () => {
    const hero = seed({ flux: 2 });
    const state = structuredClone(gamestate());

    expect(stateSkillTreeReset(state, hero.id)).toBe(jobId);
    expect(state.materials[fluxId].quantity).toBe(1);
    expect(state.world.party[0].skillTreeNodes[jobId]).toEqual([]);
    expect(state.world.party[0].combatOrders[jobId]?.[0].enabled).toBe(false);
    expect(state.regalias.entries[0]).toMatchObject({
      skillTreeNodeIds: [],
      combatOrders: [{ enabled: false }],
    });
  });

  it("keeps orders on for skills each build's own gear still grants", () => {
    const heroArmed = seed({ heroBlade: true });
    const state = structuredClone(gamestate());
    stateSkillTreeReset(state, heroArmed.id);
    expect(state.world.party[0].combatOrders[jobId]?.[0].enabled).toBe(true);
    expect(state.regalias.entries[0].combatOrders[0].enabled).toBe(false);

    const regaliaArmed = seed({ regaliaBlade: true });
    const second = structuredClone(gamestate());
    stateSkillTreeReset(second, regaliaArmed.id);
    expect(second.world.party[0].combatOrders[jobId]?.[0].enabled).toBe(false);
    expect(second.regalias.entries[0].combatOrders[0].enabled).toBe(true);
  });

  it('keeps the flux when there is nothing to refund', () => {
    const hero = seed({ flux: 2 });
    const state = structuredClone(gamestate());
    stateSkillTreeReset(state, hero.id);

    expect(stateSkillTreeReset(state, hero.id)).toBeUndefined();
    expect(state.materials[fluxId].quantity).toBe(1);
  });

  it('refuses without a flux', () => {
    const hero = seed({ flux: 0 });
    const state = structuredClone(gamestate());

    expect(stateSkillTreeReset(state, hero.id)).toBeUndefined();
    expect(state).toEqual(gamestate());
  });

  it('resets only the live tree without a current regalia', () => {
    const hero = seed({ withRegalia: false });
    const state = structuredClone(gamestate());

    expect(stateSkillTreeReset(state, hero.id)).toBe(jobId);
    expect(state.world.party[0].skillTreeNodes[jobId]).toEqual([]);
    expect(live().skillTreeNodes[jobId]).toEqual(ids('strike-node'));
    expect(regalia()).toBeUndefined();
  });
});
