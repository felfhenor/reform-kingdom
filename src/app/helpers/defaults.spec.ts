import {
  defaultMonsterTypeDamageBonus,
  defaultTravelState,
} from '@helpers/defaults';
import { describe, expect, it } from 'vitest';

describe('defaultTravelState', () => {
  it('should return an idle travel state with an empty path', () => {
    expect(defaultTravelState()).toEqual({
      status: 'Idle',
      path: [],
      ticksIntoStep: 0,
    });
  });
});

describe('defaultMonsterTypeDamageBonus', () => {
  it('should return every MonsterType zeroed', () => {
    expect(defaultMonsterTypeDamageBonus()).toEqual({
      Humanoid: 0,
      Demon: 0,
      Amalgamation: 0,
      Insect: 0,
      Beast: 0,
      Spirit: 0,
    });
  });
});
