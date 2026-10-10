import { describe, expect, it } from 'vitest';

import { ensureJob } from '@helpers/content/ensure-job';
import { ensureSkill } from '@helpers/content/ensure-skill';
import {
  heroesSelectCharacter,
  heroesSelectedCharacterId,
} from '@helpers/engine/ui';
import {
  tutorialRestoreActiveTarget,
  tutorialSkip,
  tutorialStart,
  tutorialTargetRegister,
  tutorialTargetUnregister,
} from '@helpers/tutorial/tutorial-engine.ui';
import type { ElementRef } from '@angular/core';
import type { EquipmentSkillId, JobId } from '@interfaces';
import { buildCharacter } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

describe('tutorialRestoreActiveTarget', () => {
  const burst = ensureSkill({
    id: 'Inferno' as EquipmentSkillId,
    name: 'Inferno',
    special: true,
  });
  const burstJob = ensureJob({
    id: 'job-burst' as JobId,
    name: 'Burster',
    skillPath: [
      { pathName: 'Inferno', levels: [{ level: 1, skillId: burst.id }] },
    ],
  });
  const plainJob = ensureJob({ id: 'job-plain' as JobId, name: 'Plain' });
  const plain = buildCharacter({ name: 'Plain', jobId: plainJob.id });
  const burster = buildCharacter({ name: 'Burster', jobId: burstJob.id });

  it('reselects the burst hero after the player switches away', async () => {
    seedContent([burstJob, plainJob, burst]);
    seedGamestate((state) => {
      state.world.party = [plain, burster];
    });

    tutorialStart('burst-skills');
    expect(heroesSelectedCharacterId()).toBe(burster.id);

    heroesSelectCharacter(plain.id);
    tutorialRestoreActiveTarget();
    expect(heroesSelectedCharacterId()).toBe(burster.id);

    await tutorialSkip();
  });

  it('leaves the selection alone while the target is on screen', async () => {
    seedContent([burstJob, plainJob, burst]);
    seedGamestate((state) => {
      state.world.party = [plain, burster];
    });
    const target = { nativeElement: document.createElement('div') };

    tutorialStart('burst-skills');
    tutorialTargetRegister('hero-burst-skill', target as ElementRef);
    heroesSelectCharacter(plain.id);
    tutorialRestoreActiveTarget();
    expect(heroesSelectedCharacterId()).toBe(plain.id);

    tutorialTargetUnregister('hero-burst-skill');
    await tutorialSkip();
  });
});
