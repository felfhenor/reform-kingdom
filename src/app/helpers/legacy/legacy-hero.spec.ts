import { describe, expect, it } from 'vitest';

import { ensureJob } from '@helpers/content/ensure-job';
import { ensureSkillTreeNode } from '@helpers/content/ensure-skilltreenode';
import { legacyHeroSnapshot } from '@helpers/legacy/legacy-hero';
import type { JobId, SkillTreeNodeId } from '@interfaces';
import { buildCharacter } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

const warriorId = 'warrior' as JobId;
const mageId = 'mage' as JobId;

const warrior = ensureJob({
  id: warriorId,
  name: 'Warrior',
  specializationRows: ['Bastion'],
});
const bastion = ensureSkillTreeNode({
  id: 'bastion' as SkillTreeNodeId,
  name: 'Warrior: Bastion',
  jobId: warriorId,
  row: '',
  sprite: 'bastion-art',
});
const slash = ensureSkillTreeNode({
  id: 'slash' as SkillTreeNodeId,
  name: 'Warrior: Slash',
  jobId: warriorId,
  row: 'Bastion',
});

describe('legacyHeroSnapshot', () => {
  it('captures the spec and every job the hero used', () => {
    seedContent([warrior, bastion, slash]);
    seedGamestate();
    const hero = buildCharacter({
      jobId: warriorId,
      jobProgress: { [mageId]: { level: 5, xp: { current: 0, maximum: 10 } } },
      skillTreeNodes: {
        [warriorId]: [slash.id, bastion.id],
        [mageId]: [slash.id],
      },
    });

    expect(legacyHeroSnapshot(hero)).toEqual({
      specialization: { name: 'Bastion', sprite: 'bastion-art' },
      jobsUsed: [warriorId, mageId],
    });
  });

  it('leaves the spec out when none is learned', () => {
    seedContent([warrior, slash]);
    seedGamestate();
    const hero = buildCharacter({
      jobId: warriorId,
      skillTreeNodes: { [warriorId]: [slash.id] },
    });

    expect(legacyHeroSnapshot(hero).specialization).toBeUndefined();
  });
});
