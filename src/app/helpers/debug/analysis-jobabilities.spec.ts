import { describe, expect, it } from 'vitest';

import { ensureJob } from '@helpers/content/ensure-job';
import { ensureJobAbility } from '@helpers/content/ensure-jobability';
import { runJobAbilitiesAnalysis } from '@helpers/debug/analysis-jobabilities';
import type {
  AnalysisCheck,
  JobAbilityId,
  JobAbilityLevel,
  JobAbilityType,
  JobId,
} from '@interfaces';
import { seedContent } from '@/testing/content';

function ability(name: string, type: string) {
  return ensureJobAbility({
    id: `${name}-id` as JobAbilityId,
    name,
    type: type as JobAbilityType,
  });
}

function rank(name: string, level: number): JobAbilityLevel {
  return { jobAbilityId: `${name}-id` as JobAbilityId, level, value: 1 };
}

function job(abilities: JobAbilityLevel[]) {
  return ensureJob({ id: 'Job-id' as JobId, name: 'Job', abilities });
}

function problems(status: AnalysisCheck['status']): string[] {
  return runJobAbilitiesAnalysis()
    .checks.filter((check) => check.status === status)
    .map((check) => check.message);
}

describe('runJobAbilitiesAnalysis', () => {
  it('passes valid, used abilities with increasing ranks', () => {
    seedContent([
      ability('Mend', 'RestoreHealthOOC'),
      job([rank('Mend', 1), rank('Mend', 25)]),
    ]);

    expect(problems('fail')).toEqual([]);
    expect(problems('warning')).toEqual([]);
  });

  it('fails a job reference that does not resolve to a job ability', () => {
    seedContent([job([rank('Missing', 1)])]);

    expect(problems('fail')).toEqual([
      'Job: jobAbilityId "Missing-id" does not resolve to a JobAbility.',
    ]);
  });

  it('fails an ability with an invalid type', () => {
    seedContent([ability('Typo', 'RestoreHelth'), job([rank('Typo', 1)])]);

    expect(problems('fail')).toEqual([
      'Typo: has an invalid type "RestoreHelth".',
    ]);
  });

  it('fails ranks that are not strictly increasing', () => {
    seedContent([
      ability('Mend', 'RestoreHealthOOC'),
      job([rank('Mend', 25), rank('Mend', 25)]),
    ]);

    expect(problems('fail')).toEqual([
      'Job: "Mend" rank levels are not strictly increasing (25, 25).',
    ]);
  });

  it('fails two abilities with the same type on one job', () => {
    seedContent([
      ability('Mend', 'RestoreHealthOOC'),
      ability('Soothe', 'RestoreHealthOOC'),
      job([rank('Mend', 1), rank('Soothe', 1)]),
    ]);

    expect(problems('fail')).toEqual([
      'Job: "Soothe" and "Mend" share the type RestoreHealthOOC.',
    ]);
  });

  it('warns about an ability no job uses', () => {
    seedContent([ability('Orphan', 'Ambush'), job([])]);

    expect(problems('warning')).toEqual(['Orphan: is not used by any job.']);
  });
});
