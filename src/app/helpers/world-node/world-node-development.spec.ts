import { describe, expect, it } from 'vitest';

import {
  pruneInvalidWorldNodeDevelopmentLevels,
  worldNodeDevelopmentIsMaxLevel,
  worldNodeDevelopmentLevelUpCost,
  worldNodeDevelopmentMaxLevel,
} from '@helpers/world-node/world-node-development';
import type { ItemId, WorldNodeDevelopable } from '@interfaces';

function buildDevelopable(required: number[] = [500, 10000, 25000]) {
  return {
    levels: required.map((amount) => ({
      costs: [{ itemId: 'Gold Coin' as ItemId, required: amount }],
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

  it('returns an empty array past the last level', () => {
    expect(worldNodeDevelopmentLevelUpCost(buildDevelopable(), 99)).toEqual([]);
  });
});

describe('pruneInvalidWorldNodeDevelopmentLevels', () => {
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
});
