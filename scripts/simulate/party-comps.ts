import { getEntriesByType } from '@helpers/content';
import type { JobContent } from '@interfaces';
import { PARTY_SIZE } from './constants';
import type { PartyComp } from './types';

// Pulled live from loaded content (gamedata/job/*.yml) rather than a
// hardcoded list, so a new job added to the game shows up here with no code
// change required. Must run after `bootstrapContent()`.
export function jobNames(): string[] {
  return getEntriesByType<JobContent>('job').map((job) => job.name);
}

function monoJobComps(jobs: string[]): PartyComp[] {
  return jobs.map((job) => ({
    label: `${PARTY_SIZE}x ${job}`,
    jobNames: Array(PARTY_SIZE).fill(job),
  }));
}

// One of each job, cycling through the list if there are fewer jobs than
// party slots - a generic "uses everything" comp that doesn't need to know
// which jobs actually exist.
function balancedComp(jobs: string[]): PartyComp {
  const partyJobs = Array.from(
    { length: PARTY_SIZE },
    (_, i) => jobs[i % jobs.length],
  );
  return { label: `Balanced (${partyJobs.join('/')})`, jobNames: partyJobs };
}

// One comp per job that deliberately excludes it - generalizes "No Healer"/
// "No Melee" style known-weak comps to whatever jobs actually exist, instead
// of hardcoding specific role names that could drift out of sync with
// gamedata.
function excludingEachJobComps(jobs: string[]): PartyComp[] {
  if (jobs.length < 2) return [];

  return jobs.map((excluded) => {
    const remaining = jobs.filter((job) => job !== excluded);
    const partyJobs = Array.from(
      { length: PARTY_SIZE },
      (_, i) => remaining[i % remaining.length],
    );
    return {
      label: `No ${excluded} (${partyJobs.join('/')})`,
      jobNames: partyJobs,
    };
  });
}

// A small, hand-picked set that runs by default: single-job extremes, a
// balanced mix, and one "missing this job" comp per job - known choke-point
// shapes the report should flag, built entirely from loaded content.
export function curatedPartyComps(): PartyComp[] {
  const jobs = jobNames();
  return [
    ...monoJobComps(jobs),
    balancedComp(jobs),
    ...excludingEachJobComps(jobs),
  ];
}

// Every unique job multiset for a `PARTY_SIZE`-person party - order within a
// party doesn't affect balance, so combinations-with-repetition (not
// permutations) is the right count: C(jobs + size - 1, size).
function combinationsWithRepetition(
  jobs: string[],
  size: number,
  start = 0,
): string[][] {
  if (size === 0) return [[]];

  const results: string[][] = [];
  for (let i = start; i < jobs.length; i++) {
    const rest = combinationsWithRepetition(jobs, size - 1, i);
    rest.forEach((combo) => results.push([jobs[i], ...combo]));
  }

  return results;
}

export function exhaustivePartyComps(): PartyComp[] {
  return combinationsWithRepetition(jobNames(), PARTY_SIZE).map((combo) => ({
    label: combo.join('/'),
    jobNames: combo,
  }));
}
