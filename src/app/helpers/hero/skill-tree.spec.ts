import { beforeEach, describe, expect, it } from 'vitest';

import { ensureJob } from '@helpers/content/ensure-job';
import { ensureSkillTreeNode } from '@helpers/content/ensure-skilltreenode';
import { characterNonGearEffects } from '@helpers/hero/hero-effect';
import {
  characterSkillTreeAutoPicks,
  characterSkillTreeAvailableSp,
  characterSkillTreeCanLearn,
  characterSkillTreesMigrate,
  characterSkillTreeWithAdditions,
  characterSpecNode,
  regaliaSkillTreeMigrate,
  skillTreeEarnedSp,
  skillTreePrune,
} from '@helpers/hero/skill-tree';
import type {
  Character,
  JobId,
  SkillTreeNodeContent,
  SkillTreeNodeId,
} from '@interfaces';
import { buildCharacter } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { buildRegalia } from '@/testing/regalia';

const jobId = 'tree-job' as JobId;
const otherJobId = 'other-job' as JobId;

function node(
  id: string,
  overrides: Partial<SkillTreeNodeContent> = {},
): SkillTreeNodeContent {
  return ensureSkillTreeNode({
    id: id as SkillTreeNodeId,
    name: `Job: ${id}`,
    jobId,
    level: 1,
    row: 'Abilities',
    ...overrides,
  });
}

const ids = (...names: string[]) => names as SkillTreeNodeId[];

// strike (default) -> strike2 (Lv 10); aura (default); oath (Lv 15) -> left | right; leftPerk (Lv 20) needs left; oathChild (Lv 20) needs either option.
const tree = [
  node('strike', { default: true }),
  node('strike2', { level: 10, requiredSkillTreeNodeIds: ids('strike') }),
  node('aura', {
    default: true,
    effects: [{ kind: 'Stat', stat: 'Strength', value: 3 }],
  }),
  node('oath', { level: 15, optionSkillTreeNodeIds: ids('left', 'right') }),
  node('left', { name: 'Job: Stalker', level: 0, row: '' }),
  node('right', { name: 'Job: Wayfinder', level: 0, row: '' }),
  node('leftPerk', { level: 20, requiredSkillTreeNodeIds: ids('left') }),
  node('oathChild', { level: 20, requiredSkillTreeNodeIds: ids('oath') }),
];

function hero(overrides: Partial<Character> = {}): Character {
  return buildCharacter({ jobId, ...overrides });
}

beforeEach(() => {
  seedContent([
    ensureJob({
      id: jobId,
      name: 'Job',
      treeVersion: 2,
      specializationRows: ['Stalker', 'Wayfinder'],
    }),
    ensureJob({ id: otherJobId, name: 'Other', treeVersion: 1 }),
    ...tree,
  ]);
});

describe('skillTreeEarnedSp', () => {
  it('starts at 2, gains 1 every 2 levels and stops at level 50', () => {
    expect(skillTreeEarnedSp(1)).toBe(2);
    expect(skillTreeEarnedSp(3)).toBe(3);
    expect(skillTreeEarnedSp(50)).toBe(26);
    expect(skillTreeEarnedSp(99)).toBe(26);
  });
});

describe('characterSkillTreeCanLearn', () => {
  const at = (level: number, learned: string[]) =>
    hero({ level, skillTreeNodes: { [jobId]: ids(...learned) } });

  it('needs the column level, the parents and a free SP', () => {
    expect(
      characterSkillTreeCanLearn(at(9, ['strike']), ids('strike2')[0]),
    ).toBe(false);
    expect(
      characterSkillTreeCanLearn(at(10, ['aura']), ids('strike2')[0]),
    ).toBe(false);
    expect(
      characterSkillTreeCanLearn(at(10, ['strike']), ids('strike2')[0]),
    ).toBe(true);
    expect(
      characterSkillTreeCanLearn(at(1, ['strike', 'aura']), ids('strike2')[0]),
    ).toBe(false);
  });

  it('learns an oath through one option, locking out the other', () => {
    expect(characterSkillTreeCanLearn(at(15, []), ids('oath')[0])).toBe(false);
    expect(characterSkillTreeCanLearn(at(15, []), ids('left')[0])).toBe(true);
    expect(characterSkillTreeCanLearn(at(15, ['left']), ids('right')[0])).toBe(
      false,
    );
  });

  it('accepts either option for a child that requires the oath itself', () => {
    expect(
      characterSkillTreeCanLearn(at(20, ['right']), ids('oathChild')[0]),
    ).toBe(true);
    expect(
      characterSkillTreeCanLearn(at(20, ['right']), ids('leftPerk')[0]),
    ).toBe(false);
  });

  it('counts SP against the job being viewed, not other jobs', () => {
    const multi = hero({
      level: 3,
      skillTreeNodes: { [jobId]: ids('strike'), [otherJobId]: ids('x', 'y') },
    });

    expect(characterSkillTreeAvailableSp(multi, jobId)).toBe(2);
  });
});

describe('characterSkillTreeWithAdditions', () => {
  const at = (level: number) =>
    hero({ level, skillTreeNodes: { [jobId]: ids('strike', 'aura') } });

  it('appends valid additions in level order, letting one unlock the next', () => {
    expect(
      characterSkillTreeWithAdditions(
        at(20),
        ids('leftPerk', 'strike', 'aura', 'left'),
      ),
    ).toEqual(ids('strike', 'aura', 'left', 'leftPerk'));
  });

  it('rejects removals, unknown ids and locked or excluded nodes', () => {
    expect(
      characterSkillTreeWithAdditions(at(20), ids('strike')),
    ).toBeUndefined();
    expect(
      characterSkillTreeWithAdditions(at(20), ids('strike', 'aura', 'gone')),
    ).toBeUndefined();
    expect(
      characterSkillTreeWithAdditions(
        at(20),
        ids('strike', 'aura', 'leftPerk'),
      ),
    ).toBeUndefined();
    expect(
      characterSkillTreeWithAdditions(
        at(15),
        ids('strike', 'aura', 'left', 'right'),
      ),
    ).toBeUndefined();
  });

  it('rejects more additions than the free SP covers', () => {
    // 9 SP at Lv 15; 8 already spent leaves room for one of the two additions.
    const spent = ids('strike', 'aura', 'a', 'b', 'c', 'd', 'e', 'f');
    const nearlyFull = hero({ level: 15, skillTreeNodes: { [jobId]: spent } });

    expect(
      characterSkillTreeWithAdditions(nearlyFull, [
        ...spent,
        ...ids('strike2'),
      ]),
    ).toBeDefined();
    expect(
      characterSkillTreeWithAdditions(nearlyFull, [
        ...spent,
        ...ids('strike2', 'left'),
      ]),
    ).toBeUndefined();
  });
});

describe('characterSkillTreeAutoPicks', () => {
  it('buys the lowest-level learnable nodes, first oath option, until SP runs out', () => {
    const picks = (level: number, learned: string[]) =>
      characterSkillTreeAutoPicks(
        hero({ level, skillTreeNodes: { [jobId]: ids(...learned) } }),
      );

    expect(picks(1, ['strike', 'aura'])).toEqual([]);
    expect(picks(19, ['strike', 'aura'])).toEqual(ids('strike2', 'left'));
    expect(picks(50, ['strike', 'aura'])).toEqual(
      ids('strike2', 'left', 'leftPerk', 'oathChild'),
    );
  });
});

describe('skillTreePrune', () => {
  it('drops unknown, too-high and orphaned nodes in one pass', () => {
    expect(
      skillTreePrune(
        jobId,
        ids('gone', 'strike2', 'aura', 'left', 'leftPerk'),
        20,
      ),
    ).toEqual(ids('aura', 'left', 'leftPerk'));
    expect(skillTreePrune(jobId, ids('strike', 'strike2'), 9)).toEqual(
      ids('strike'),
    );
  });

  it('keeps one option per oath', () => {
    expect(skillTreePrune(jobId, ids('left', 'right'), 15)).toEqual(
      ids('left'),
    );
  });

  it('refunds from the highest level down when over budget', () => {
    expect(
      skillTreePrune(jobId, ids('strike', 'aura', 'strike2', 'left'), 3),
    ).toEqual(ids('strike', 'aura'));
  });
});

describe('characterSkillTreesMigrate', () => {
  it('seeds every held job without a tree to its defaults', () => {
    const migrated = characterSkillTreesMigrate(
      hero({
        skillTreeNodes: undefined,
        skillTreeVersions: undefined,
        jobProgress: {
          [otherJobId]: { level: 5, xp: { current: 0, maximum: 1 } },
        },
      }),
    );

    expect(migrated).toEqual({
      skillTreeNodes: { [jobId]: ids('strike', 'aura'), [otherJobId]: [] },
      skillTreeVersions: { [jobId]: 2, [otherJobId]: 1 },
    });
  });

  it('keeps a current tree, resets a stale one and drops removed jobs', () => {
    const current = characterSkillTreesMigrate(
      hero({
        level: 10,
        skillTreeNodes: { [jobId]: ids('strike', 'strike2') },
        skillTreeVersions: { [jobId]: 2 },
      }),
    );
    expect(current.skillTreeNodes[jobId]).toEqual(ids('strike', 'strike2'));

    const stale = characterSkillTreesMigrate(
      hero({
        level: 10,
        skillTreeNodes: {
          [jobId]: ids('strike', 'strike2'),
          ['gone' as JobId]: [],
        },
        skillTreeVersions: { [jobId]: 1 },
      }),
    );
    expect(stale.skillTreeNodes).toEqual({ [jobId]: ids('strike', 'aura') });
  });
});

describe('regaliaSkillTreeMigrate', () => {
  it("defaults an old regalia's tree and prunes a current one to the hero's level", () => {
    const owner = hero({ level: 9 });

    expect(
      regaliaSkillTreeMigrate(
        buildRegalia([], {
          jobId,
          skillTreeNodeIds: undefined as unknown as SkillTreeNodeId[],
        }),
        owner,
      ),
    ).toEqual({ skillTreeNodeIds: ids('strike', 'aura'), skillTreeVersion: 2 });

    expect(
      regaliaSkillTreeMigrate(
        buildRegalia([], {
          jobId,
          skillTreeNodeIds: ids('strike', 'strike2'),
          skillTreeVersion: 2,
        }),
        owner,
      ).skillTreeNodeIds,
    ).toEqual(ids('strike'));
  });
});

describe('learned node effects', () => {
  it("apply for the hero's current job only", () => {
    const learned = { [jobId]: ids('aura'), [otherJobId]: ids('aura') };

    expect(characterNonGearEffects(hero({ skillTreeNodes: learned }))).toEqual([
      { kind: 'Stat', stat: 'Strength', value: 3 },
    ]);
    expect(
      characterNonGearEffects(
        hero({ jobId: otherJobId, skillTreeNodes: { [jobId]: ids('aura') } }),
      ),
    ).toEqual([]);
  });
});

describe('characterSpecNode', () => {
  it('finds the learned spec option, ignoring unknown ids', () => {
    const jala = hero({
      skillTreeNodes: { [jobId]: ids('strike', 'gone', 'left') },
      skillTreeVersions: { [jobId]: 2 },
    });

    expect(characterSpecNode(jala)?.id).toBe('left');
  });

  it('is undefined without a learned spec option', () => {
    const jala = hero({
      skillTreeNodes: { [jobId]: ids('strike', 'oath') },
      skillTreeVersions: { [jobId]: 2 },
    });

    expect(characterSpecNode(jala)).toBeUndefined();
  });

  it('reads another job when asked', () => {
    const jala = hero({
      jobId: otherJobId,
      skillTreeNodes: { [jobId]: ids('right') },
      skillTreeVersions: { [jobId]: 2 },
    });

    expect(characterSpecNode(jala)).toBeUndefined();
    expect(characterSpecNode(jala, jobId)?.id).toBe('right');
  });

  it('ignores a tree built against an older treeVersion', () => {
    const jala = hero({
      skillTreeNodes: { [jobId]: ids('left') },
      skillTreeVersions: { [jobId]: 1 },
    });

    expect(characterSpecNode(jala)).toBeUndefined();
  });
});
