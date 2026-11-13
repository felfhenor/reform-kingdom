import { describe, expect, it } from 'vitest';

import {
  pruneInvalidWorldNodeDevelopmentLevels,
  worldNodeDevelopmentIsMaxLevel,
  worldNodeDevelopmentLevelUpCost,
  worldNodeDevelopmentMaxLevel,
  worldNodeDevelopmentTime,
} from '@helpers/world-node/world-node-development';
import type { ItemId, WorldNodeDevelopable } from '@interfaces';
import { seedGamestate } from '@/testing/gamestate';

function buildDevelopable(required: number[] = [500, 10000, 25000]) {
  return {
    levels: required.map((amount, index) => ({
      costs: [{ itemId: 'Gold Coin' as ItemId, required: amount }],
      developTime: (index + 1) * 300,
    })),
  } satisfies WorldNodeDevelopable;
}

describe('worldNodeDevelopmentMaxLevel', () => {
  it('is levels.length', () => {
    expect(worldNodeDevelopmentMaxLevel(buildDevelopable())).toBe(3);
  });
});

describe('worldNodeDevelopmentIsMaxLevel', () => {
  it('is false below the max achievable level', () => {
    expect(worldNodeDevelopmentIsMaxLevel(buildDevelopable(), 2)).toBe(false);
  });

  it('is true at or above the max achievable level', () => {
    expect(worldNodeDevelopmentIsMaxLevel(buildDevelopable(), 3)).toBe(true);
    expect(worldNodeDevelopmentIsMaxLevel(buildDevelopable(), 4)).toBe(true);
  });
});

describe('worldNodeDevelopmentLevelUpCost', () => {
  it('returns the costs for the next level', () => {
    expect(worldNodeDevelopmentLevelUpCost(buildDevelopable(), 0)).toEqual([
      { itemId: 'Gold Coin', required: 500 },
    ]);
  });

  it('scales the costs by the development material boost', () => {
    seedGamestate((state) => {
      state.globalEffectSums.developMaterialBoost = -0.5;
    });

    expect(worldNodeDevelopmentLevelUpCost(buildDevelopable(), 0)).toEqual([
      { itemId: 'Gold Coin', required: 250 },
    ]);
  });

  it('returns an empty array past the last level', () => {
    expect(worldNodeDevelopmentLevelUpCost(buildDevelopable(), 99)).toEqual([]);
  });
});

describe('worldNodeDevelopmentTime', () => {
  it('returns the time for the next level, and 0 past the last level', () => {
    expect(worldNodeDevelopmentTime(buildDevelopable(), 1)).toBe(600);
    expect(worldNodeDevelopmentTime(buildDevelopable(), 99)).toBe(0);
  });
});

describe('pruneInvalidWorldNodeDevelopmentLevels', () => {
  it('keeps a pending development that still has a level to reach', () => {
    const result = pruneInvalidWorldNodeDevelopmentLevels(
      { Shrine: { level: 1, developCompletesAtTick: 50 } },
      () => buildDevelopable(),
    );

    expect(result).toEqual({
      Shrine: { level: 1, developCompletesAtTick: 50 },
    });
  });

  it('drops a pending development once the clamped level is already max', () => {
    const result = pruneInvalidWorldNodeDevelopmentLevels(
      { Shrine: { level: 5, developCompletesAtTick: 50 } },
      () => buildDevelopable([500]),
    );

    expect(result).toEqual({ Shrine: { level: 1 } });
  });

  it('drops entries whose node no longer resolves to developable content', () => {
    const result = pruneInvalidWorldNodeDevelopmentLevels(
      { "Founder's Shrine": { level: 1 }, Removed: { level: 1 } },
      (nodeName) =>
        nodeName === "Founder's Shrine" ? buildDevelopable() : undefined,
    );

    expect(result).toEqual({ "Founder's Shrine": { level: 1 } });
  });

  it('clamps a stored level down to the current max level', () => {
    const result = pruneInvalidWorldNodeDevelopmentLevels(
      { "Founder's Shrine": { level: 5 } },
      () => buildDevelopable([500]),
    );

    expect(result).toEqual({ "Founder's Shrine": { level: 1 } });
  });

  // Older saves stored -1 for nodes that had no levels yet.
  it('raises a negative stored level to 0', () => {
    const result = pruneInvalidWorldNodeDevelopmentLevels(
      { 'Oasis Wellspring': { level: -1 } },
      () => buildDevelopable(),
    );

    expect(result).toEqual({ 'Oasis Wellspring': { level: 0 } });
  });
});
