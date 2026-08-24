import type {
  Character,
  Combatant,
  EquipmentSkillContent,
  EquipmentSkillId,
  GameState,
  GlobalEffect,
  GlobalEffectId,
  IsContentItem,
  JobContent,
  JobId,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('uuid', () => ({
  v4: vi.fn(() => `mock-uuid-${Math.random()}`),
}));

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/combat/combat-log', () => ({
  miscellaneousMessageLog: vi.fn(),
}));

vi.mock('@helpers/hero/global-effects', () => ({
  activeGlobalEffects: vi.fn(() => []),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

import { miscellaneousMessageLog } from '@helpers/combat/combat-log';
import { getEntry } from '@helpers/content';
import {
  healingTicksForLevel,
  healPartyToFull,
  partyGainXp,
  retrofitPartyXp,
  syncPartyHpFromCombat,
} from '@helpers/hero/character-progress';
import { activeGlobalEffects } from '@helpers/hero/global-effects';
import {
  CHARACTER_MAX_LEVEL,
  characterXpForLevel,
  createCharacter,
} from '@helpers/hero/party';
import { updateGamestate } from '@helpers/state-game';

describe('Character Progress Helper Functions', () => {
  const mockJob: JobContent = {
    id: 'job-explorer' as JobId,
    name: 'Explorer',
    __type: 'job',
    description: 'A person who seeks out new lands and experiences.',
    sprite: '0000',
    frames: 4,
    baseStats: {
      Health: 100,
      Energy: 25,
      Luck: 5,
      Intelligence: 5,
      Strength: 5,
      Vitality: 5,
      Resistance: 5,
      Agility: 10,
    },
    statsPerLevel: {
      Health: 10,
      Energy: 5,
      Luck: 0.01,
      Intelligence: 0.2,
      Strength: 0.5,
      Vitality: 0.3,
      Resistance: 0.4,
      Agility: 0.7,
    },
    equippableTypes: ['Cloth Armor', 'Hat', 'Sword', 'Spear', 'Shield'],
    statPriority: [],
    skillPath: [],
  };

  function mockGetEntry(...entries: IsContentItem[]): void {
    vi.mocked(getEntry).mockImplementation(
      (idOrName) =>
        entries.find(
          (entry) => entry.id === idOrName || entry.name === idOrName,
        ) as never,
    );
  }

  function createCharacterStub(name: string): Character {
    return createCharacter(name, 'job-explorer' as JobId);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEntry(mockJob);
  });

  describe('healingTicksForLevel', () => {
    it('returns a 10 second minimum plus twice the highest member level', () => {
      expect(
        healingTicksForLevel([{ level: 3 }, { level: 7 }, { level: 2 }]),
      ).toBe(24);
    });

    it('defaults to a minimum level of 1 for an empty party', () => {
      expect(healingTicksForLevel([])).toBe(12);
    });
  });

  describe('retrofitPartyXp', () => {
    it("rescales a character's xp.maximum to the current curve for their level", () => {
      const jala = {
        ...createCharacterStub('Jala'),
        level: 2,
        xp: { current: 50, maximum: 283 },
      };

      const [retrofitted] = retrofitPartyXp([jala]);

      expect(retrofitted.xp).toEqual({
        current: 50,
        maximum: characterXpForLevel(2),
      });
    });

    it('clamps current xp down without leveling up when it now exceeds the new maximum', () => {
      const jala = {
        ...createCharacterStub('Jala'),
        level: 2,
        xp: { current: 283, maximum: 283 },
      };

      const [retrofitted] = retrofitPartyXp([jala]);

      expect(retrofitted.level).toBe(2);
      expect(retrofitted.xp).toEqual({
        current: characterXpForLevel(2),
        maximum: characterXpForLevel(2),
      });
    });

    it('rescales jobProgress entries for held-but-inactive jobs using their own level', () => {
      const jala = {
        ...createCharacterStub('Jala'),
        jobProgress: {
          'job-warrior': { level: 5, xp: { current: 999999, maximum: 999999 } },
        },
      } as unknown as Character;

      const [retrofitted] = retrofitPartyXp([jala]);

      expect(retrofitted.jobProgress['job-warrior' as JobId]).toEqual({
        level: 5,
        xp: {
          current: characterXpForLevel(5),
          maximum: characterXpForLevel(5),
        },
      });
    });
  });

  describe('partyGainXp', () => {
    it('adds xp without leveling up when below the threshold', () => {
      const jala = createCharacterStub('Jala');

      partyGainXp(30);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: { party: [jala] },
      } as unknown as GameState);

      expect(result.world.party[0].xp).toEqual({ current: 30, maximum: 100 });
      expect(result.world.party[0].level).toBe(1);
      expect(result.world.party[0].stats).toEqual(jala.stats);
    });

    it('levels up and recalculates stats when xp meets the threshold', () => {
      const jala = createCharacterStub('Jala');

      partyGainXp(100);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: { party: [jala] },
      } as unknown as GameState);

      expect(result.world.party[0].level).toBe(2);
      expect(result.world.party[0].xp).toEqual({
        current: 0,
        maximum: characterXpForLevel(2),
      });
    });

    it('carries over remainder xp and can grant multiple levels from one large gain', () => {
      const jala = createCharacterStub('Jala');
      const totalXp = characterXpForLevel(1) + characterXpForLevel(2) + 15;

      partyGainXp(totalXp);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: { party: [jala] },
      } as unknown as GameState);

      expect(result.world.party[0].level).toBe(3);
      expect(result.world.party[0].xp.current).toBe(15);
      expect(result.world.party[0].xp.maximum).toBe(characterXpForLevel(3));
    });

    it('stops leveling at the max level and clamps xp to the final threshold', () => {
      const jala = {
        ...createCharacterStub('Jala'),
        level: CHARACTER_MAX_LEVEL,
        xp: { current: 0, maximum: characterXpForLevel(CHARACTER_MAX_LEVEL) },
      };

      partyGainXp(999999);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: { party: [jala] },
      } as unknown as GameState);

      expect(result.world.party[0].level).toBe(CHARACTER_MAX_LEVEL);
      expect(result.world.party[0].xp.current).toBe(
        result.world.party[0].xp.maximum,
      );
    });

    it('does not log anything when the character does not level up', () => {
      const jala = createCharacterStub('Jala');

      partyGainXp(30);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      updateFn({ world: { party: [jala] } } as unknown as GameState);

      expect(miscellaneousMessageLog).not.toHaveBeenCalled();
    });

    it('logs a level-up message when the character levels up', () => {
      const jala = createCharacterStub('Jala');

      partyGainXp(100);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      updateFn({ world: { party: [jala] } } as unknown as GameState);

      expect(miscellaneousMessageLog).toHaveBeenCalledWith(
        '**Jala** reached level 2!',
      );
    });

    it('logs a message for each newly learned skill on level-up', () => {
      const attackSkill: EquipmentSkillContent = {
        id: 'skill-attack' as EquipmentSkillId,
        name: 'Attack',
        __type: 'skill',
      } as EquipmentSkillContent;

      const jobWithSkills: JobContent = {
        ...mockJob,
        skillPath: [
          {
            pathName: 'Attack',
            levels: [{ level: 2, skillId: attackSkill.id }],
          },
        ],
      };

      mockGetEntry(jobWithSkills, attackSkill);

      const jala = createCharacterStub('Jala');

      partyGainXp(100);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      updateFn({ world: { party: [jala] } } as unknown as GameState);

      expect(miscellaneousMessageLog).toHaveBeenCalledWith(
        '**Jala** learned **Attack**!',
      );
    });

    it('does not log a skill when the job cannot be found', () => {
      mockGetEntry();

      const jala = createCharacterStub('Jala');

      partyGainXp(100);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      updateFn({ world: { party: [jala] } } as unknown as GameState);

      expect(miscellaneousMessageLog).toHaveBeenCalledWith(
        '**Jala** reached level 2!',
      );
      expect(miscellaneousMessageLog).toHaveBeenCalledTimes(1);
    });

    it('returns true when the gain levels up at least one character', () => {
      const jala = createCharacterStub('Jala');
      vi.mocked(updateGamestate).mockImplementation(async (fn) => {
        fn({ world: { party: [jala] } } as unknown as GameState);
      });

      expect(partyGainXp(100)).toBe(true);
    });

    it('returns false when the gain does not level up any character', () => {
      const jala = createCharacterStub('Jala');
      vi.mocked(updateGamestate).mockImplementation(async (fn) => {
        fn({ world: { party: [jala] } } as unknown as GameState);
      });

      expect(partyGainXp(30)).toBe(false);
    });

    it('scales the granted xp by any active GlobalXPGainMultiplier effect(s)', () => {
      vi.mocked(activeGlobalEffects).mockReturnValue([
        {
          id: 'wisdom' as GlobalEffectId,
          name: 'Wisdom of the Founder I',
          __type: 'globaleffect',
          description: '',
          sprite: '0000',
          startTick: 0,
          expiresAtTick: 100,
          effects: [{ effectType: 'GlobalXPGainMultiplier', value: 0.5 }],
        },
      ] as GlobalEffect[]);

      const jala = createCharacterStub('Jala');

      partyGainXp(30);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: { party: [jala] },
      } as unknown as GameState);

      expect(result.world.party[0].xp.current).toBe(45);
    });

    it('sums multiple active GlobalXPGainMultiplier effects together', () => {
      vi.mocked(activeGlobalEffects).mockReturnValue([
        {
          id: 'wisdom-1' as GlobalEffectId,
          name: 'Wisdom I',
          __type: 'globaleffect',
          description: '',
          sprite: '0000',
          startTick: 0,
          expiresAtTick: 100,
          effects: [{ effectType: 'GlobalXPGainMultiplier', value: 0.5 }],
        },
        {
          id: 'wisdom-2' as GlobalEffectId,
          name: 'Wisdom II',
          __type: 'globaleffect',
          description: '',
          sprite: '0000',
          startTick: 0,
          expiresAtTick: 100,
          effects: [{ effectType: 'GlobalXPGainMultiplier', value: 0.25 }],
        },
      ] as GlobalEffect[]);

      const jala = createCharacterStub('Jala');

      partyGainXp(100);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: { party: [jala] },
      } as unknown as GameState);

      // 100 * (1 + 0.5 + 0.25) = 175
      expect(result.world.party[0].xp.current).toBe(75);
      expect(result.world.party[0].level).toBe(2);
    });

    it('ignores active GainStats effects when computing the xp multiplier', () => {
      vi.mocked(activeGlobalEffects).mockReturnValue([
        {
          id: 'strength' as GlobalEffectId,
          name: 'Strength of the Duchy I',
          __type: 'globaleffect',
          description: '',
          sprite: '0000',
          startTick: 0,
          expiresAtTick: 100,
          effects: [{ effectType: 'GainStats', stat: 'Strength', value: 5 }],
        },
      ] as GlobalEffect[]);

      const jala = createCharacterStub('Jala');

      partyGainXp(30);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: { party: [jala] },
      } as unknown as GameState);

      expect(result.world.party[0].xp.current).toBe(30);
    });
  });

  describe('syncPartyHpFromCombat', () => {
    it('syncs hp and ep from the matching combatant, clamped to current max stats', () => {
      const jala = createCharacterStub('Jala');
      const combatant = {
        id: jala.id,
        hp: jala.stats.Health + 999,
        ep: jala.stats.Energy + 999,
      } as unknown as Combatant;

      syncPartyHpFromCombat([combatant]);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: { party: [jala] },
      } as unknown as GameState);

      expect(result.world.party[0].hp).toBe(jala.stats.Health);
      expect(result.world.party[0].ep).toBe(jala.stats.Energy);
    });

    it('leaves characters with no matching combatant untouched', () => {
      const jala = createCharacterStub('Jala');

      syncPartyHpFromCombat([]);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: { party: [jala] },
      } as unknown as GameState);

      expect(result.world.party[0]).toEqual(jala);
    });
  });

  describe('healPartyToFull', () => {
    it("restores every character's hp and ep to their current maximums", () => {
      const jala = {
        ...createCharacterStub('Jala'),
        hp: 1,
        ep: 0,
      };

      healPartyToFull();

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: { party: [jala] },
      } as unknown as GameState);

      expect(result.world.party[0].hp).toBe(jala.stats.Health);
      expect(result.world.party[0].ep).toBe(jala.stats.Energy);
    });
  });
});
