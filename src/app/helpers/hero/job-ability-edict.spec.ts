import { beforeEach, describe, expect, it } from 'vitest';

import {
  jobAbilityGatherLuckOnMonsters,
  jobAbilityShrineBoostAstralDuration,
  jobAbilityShrineBoostStrength,
} from '@helpers/hero/job-ability-edict';
import type { GameState } from '@interfaces';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';
import { abilityJobContent, buildAbilityHero } from '@/testing/job-ability';

function seedHealer(edit: (state: GameState) => void = () => {}): void {
  seedGamestate((state) => {
    state.world.party = [buildAbilityHero('Healer', 1)];
    edit(state);
  });
}

beforeEach(() => {
  seedContent(abilityJobContent('Healer', [['ShrineDurationBoost', 1, 0.5]]));
});

describe('jobAbilityGatherLuckOnMonsters', () => {
  it('holds only once gathering nodes are gone', () => {
    seedGamestate();
    expect(jobAbilityGatherLuckOnMonsters()).toBe(false);

    seedGamestate(
      (state) =>
        (state.globalEffectSums.removedWorldNodeTypes.GatherNode = true),
    );
    expect(jobAbilityGatherLuckOnMonsters()).toBe(true);
  });
});

describe('Sanctified Incantations rerouting', () => {
  it('does neither in a normal run', () => {
    seedHealer();

    expect(jobAbilityShrineBoostAstralDuration()).toBe(0);
    expect(jobAbilityShrineBoostStrength()).toBe(0);
  });

  it('extends astral spells once shrines are gone', () => {
    seedHealer(
      (state) => (state.globalEffectSums.removedWorldNodeTypes.Shrine = true),
    );

    expect(jobAbilityShrineBoostAstralDuration()).toBe(0.5);
    expect(jobAbilityShrineBoostStrength()).toBe(0);
  });

  it('strengthens shrine buffs once they are permanent', () => {
    seedHealer((state) => (state.globalEffectSums.shrineBuffsPermanent = true));

    expect(jobAbilityShrineBoostStrength()).toBe(0.5);
    expect(jobAbilityShrineBoostAstralDuration()).toBe(0);
  });

  it('gives nothing without a Healer in the party', () => {
    seedGamestate((state) => {
      state.globalEffectSums.removedWorldNodeTypes.Shrine = true;
      state.globalEffectSums.shrineBuffsPermanent = true;
    });

    expect(jobAbilityShrineBoostAstralDuration()).toBe(0);
    expect(jobAbilityShrineBoostStrength()).toBe(0);
  });
});
