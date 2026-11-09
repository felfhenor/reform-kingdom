import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/decree/auto-mode-state');
vi.mock('@helpers/commission/commission-kill-progress');
vi.mock('@helpers/hero/character-progress');
vi.mock('@helpers/encounter/encounter');
vi.mock('@helpers/encounter/encounter-random-combat');
vi.mock('@helpers/hero/travel');
vi.mock('@helpers/town/raid/town-raid-resolve');
vi.mock('@helpers/task/task-progress');
vi.mock('@helpers/engine/sfx');

import { captureAnalyticsEvents } from '@/testing/analytics';
import {
  buildCharacter,
  buildCombat,
  buildHeroCombatant,
  buildMonsterCombatant,
} from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';
import {
  combatCheckIfOver,
  combatResolveAutoWin,
  isCombatOver,
} from '@helpers/combat/combat-end';
import { combatantMessageToken, combatLog } from '@helpers/combat/combat-log';
import { monsterXpReward, xpForOverLevel } from '@helpers/combat/monster';
import { commissionRecordMonsterKill } from '@helpers/commission/commission-kill-progress';
import {
  ensureEncounter,
  ensureEncounterRandom,
} from '@helpers/content/ensure-encounternode';
import { ensureDroppedReward } from '@helpers/content/ensure-helpers-drops';
import { ensureItem } from '@helpers/content/ensure-item';
import { ensureMonster } from '@helpers/content/ensure-monster';
import { ensureRegion } from '@helpers/content/ensure-region';
import { ensureTown } from '@helpers/content/ensure-town';
import {
  autoModeRecordClauseFailure,
  autoModeRecordClauseSuccess,
  autoModeRecordNodeFailure,
  autoModeRecordNodeSuccess,
  autoModeResetNodeFailureCounts,
} from '@helpers/decree/auto-mode-state';
import { encounterStartFight } from '@helpers/encounter/encounter';
import {
  encounterRandomHandleVictory,
  encounterRandomNextFightIndex,
} from '@helpers/encounter/encounter-random-combat';
import { playGameSFX } from '@helpers/engine/sfx';
import {
  partyGainXp,
  syncPartyHpFromCombat,
} from '@helpers/hero/character-progress';
import { travelBeginDeathsDoor } from '@helpers/hero/travel';
import { gamestate } from '@helpers/state-game';
import { taskRecordEncounterClear } from '@helpers/task/task-progress';
import {
  raidResolveDefeat,
  raidResolveVictory,
} from '@helpers/town/raid/town-raid-resolve';
import type {
  CharacterId,
  Combat,
  Combatant,
  EncounterContent,
  EncounterId,
  EncounterRandomId,
  ItemId,
  MonsterId,
  RegionId,
  TownId,
} from '@interfaces';

const goblinId = 'goblin' as MonsterId;
const encounterId = 'field-ruins' as EncounterId;
const oreId = 'ore' as ItemId;
const larsiaId = 'larsia' as TownId;

const goblin = ensureMonster({
  id: goblinId,
  name: 'Goblin',
  xp: { min: 100, max: 100, bonusPerLevel: 0 },
  drops: [ensureDroppedReward({ itemId: oreId, min: 3, max: 3, chance: 100 })],
});

const items = [
  ensureItem({ id: oreId, name: 'Ore' }),
  ensureItem({ id: 'gold-coin' as ItemId, name: 'Gold Coin' }),
];

function encounter(overrides: Partial<EncounterContent> = {}) {
  return ensureEncounter({
    id: encounterId,
    name: 'Field Ruins',
    fights: [{ monsters: [] }],
    levelRange: { min: 3, max: 5 },
    ...overrides,
  });
}

function hero(id: string, overrides: Partial<Combatant> = {}): Combatant {
  return buildHeroCombatant(
    buildCharacter({ id: id as CharacterId, name: id }),
    { hp: 10, ...overrides },
  );
}

function deadGoblin(level = 5): Combatant {
  return buildMonsterCombatant(goblin, { hp: 0, level });
}

function liveGoblin(): Combatant {
  return buildMonsterCombatant(goblin, { hp: 10 });
}

function fight(overrides: Partial<Combat> = {}): Combat {
  return buildCombat({
    locationName: 'Field Ruins',
    heroes: [hero('hero-1')],
    guardians: [deadGoblin()],
    ...overrides,
  });
}

// Seeds the combat as the live one, so a reset is observable.
function endFight(combat: Combat): boolean {
  seedGamestate((state) => (state.world.combat = combat));
  return inTick(() => combatCheckIfOver(combat));
}

function logMessages(): string[] {
  return combatLog().map((entry) => entry.message);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(partyGainXp).mockReturnValue([]);
  seedContent([goblin, encounter(), ...items]);
});

describe('isCombatOver', () => {
  it('ends once every hero or every guardian is dead, ignoring helpers', () => {
    const alive = hero('helper-1');
    const dead = hero('hero-1', { hp: 0 });

    expect(
      isCombatOver(
        fight({ heroes: [dead], helpers: [alive], guardians: [liveGoblin()] }),
      ),
    ).toBe(true);
    expect(
      isCombatOver(
        fight({
          heroes: [hero('hero-1')],
          helpers: [hero('helper-1', { hp: 0 })],
          guardians: [liveGoblin()],
        }),
      ),
    ).toBe(false);
  });
});

describe('combatCheckIfOver', () => {
  it('returns false and leaves the combat alone while both sides stand', () => {
    const combat = fight({ guardians: [liveGoblin()] });

    expect(endFight(combat)).toBe(false);
    expect(gamestate().world.combat).toEqual(combat);
  });

  describe('on victory', () => {
    it('records the win for auto mode, the bestiary and commissions, then resets combat', () => {
      const events = captureAnalyticsEvents();
      const combat = fight({ encounterId, fightIndex: 0 });

      expect(endFight(combat)).toBe(true);

      expect(syncPartyHpFromCombat).toHaveBeenCalledWith(combat.heroes);
      expect(autoModeRecordClauseSuccess).toHaveBeenCalled();
      expect(autoModeRecordNodeSuccess).toHaveBeenCalledWith('Field Ruins');
      expect(autoModeRecordClauseFailure).not.toHaveBeenCalled();
      expect(gamestate().bestiary[goblinId]).toMatchObject({
        kills: 1,
        minLevelFound: 5,
        foundAtNodes: ['Field Ruins'],
      });
      expect(commissionRecordMonsterKill).toHaveBeenCalledWith(goblinId);
      expect(events).toContain('Combat:Encounter:Win');
      expect(gamestate().world.combat).toBeUndefined();
      expect(gamestate().runStats.fightsWon).toBe(1);
    });

    it('counts an auto-won fight as a win without fighting it', () => {
      const combat = fight({ encounterId, fightIndex: 0 });
      seedGamestate();

      inTick(() => combatResolveAutoWin(combat, true));

      expect(gamestate().runStats.fightsWon).toBe(1);
    });

    it('records summoned guardians in the bestiary without granting rewards for them', () => {
      const summon = buildMonsterCombatant(goblin, {
        hp: 0,
        summonerId: 'enemy-1',
      });

      endFight(fight({ encounterId, fightIndex: 0, guardians: [summon] }));

      expect(gamestate().bestiary[goblinId]).toMatchObject({
        kills: 1,
        foundAtNodes: ['Field Ruins'],
      });
      expect(commissionRecordMonsterKill).not.toHaveBeenCalled();
      expect(vi.mocked(partyGainXp).mock.calls[0][0](5)).toBe(0);
      expect(gamestate().materials[oreId]).toBeUndefined();
    });

    it('starts the next fight, granting this fights drops first, without resetting combat', () => {
      seedContent([
        goblin,
        encounter({ fights: [{ monsters: [] }, { monsters: [] }] }),
        ...items,
      ]);
      const combat = fight({ encounterId, fightIndex: 0 });

      endFight(combat);

      expect(encounterStartFight).toHaveBeenCalledWith(
        encounterId,
        1,
        'Field Ruins',
        [100],
        0,
      );
      expect(gamestate().materials[oreId]?.quantity).toBe(3);
      expect(gamestate().world.combat).toEqual(combat);
      expect(taskRecordEncounterClear).not.toHaveBeenCalled();
      // Each fight of a chained encounter counts on its own.
      expect(gamestate().runStats.fightsWon).toBe(1);
    });

    it('whispers after a won fight and starts the next one after its delay', () => {
      seedContent([
        goblin,
        encounter({
          fights: [
            {
              monsters: [],
              postFightWhisper: 'Steady now.',
              postFightDelay: 5,
            },
            { monsters: [] },
          ],
        }),
        ...items,
      ]);

      endFight(fight({ encounterId, fightIndex: 0 }));

      expect(logMessages()).toContain('*The Founder whispers: "Steady now."*');
      expect(encounterStartFight).toHaveBeenCalledWith(
        encounterId,
        1,
        'Field Ruins',
        [100],
        5,
      );
    });

    it("whispers after the node's last fight too", () => {
      seedContent([
        goblin,
        encounter({
          fights: [{ monsters: [], postFightWhisper: "It's done." }],
        }),
        ...items,
      ]);

      endFight(fight({ encounterId, fightIndex: 0 }));

      expect(logMessages()).toContain(`*The Founder whispers: "It's done."*`);
      expect(encounterStartFight).not.toHaveBeenCalled();
    });

    it('clears the node after its last fight, granting kill drops and completion rewards together', () => {
      seedContent([
        goblin,
        encounter({
          completionRewards: [
            ensureDroppedReward({ itemId: oreId, min: 4, max: 4, chance: 100 }),
          ],
        }),
        ...items,
      ]);
      const events = captureAnalyticsEvents();

      endFight(fight({ encounterId, fightIndex: 0 }));

      expect(gamestate().materials[oreId]?.quantity).toBe(7);
      expect(
        logMessages().filter((message) =>
          message.startsWith('The party found'),
        ),
      ).toHaveLength(1);
      expect(events).toContain('World:Node:Complete:Field Ruins');
      expect(taskRecordEncounterClear).toHaveBeenCalledWith('Field Ruins');
      expect(encounterStartFight).not.toHaveBeenCalled();
    });

    it('records no node clear for a bare fight with no encounter', () => {
      endFight(fight());

      expect(taskRecordEncounterClear).not.toHaveBeenCalled();
      expect(gamestate().world.combat).toBeUndefined();
    });

    describe('region seals', () => {
      const carrinaId = 'carrina' as RegionId;
      const carrina = (sealEncounterId: EncounterId) =>
        ensureRegion({
          id: carrinaId,
          name: 'Carrina',
          seal: { sealEncounterId, parTicks: 100 },
        });

      function clearAt(tick: number, sealedAt?: number): void {
        const combat = fight({ encounterId, fightIndex: 0 });
        seedGamestate((state) => {
          state.clock.numTicks = tick;
          state.world.combat = combat;
          if (sealedAt !== undefined)
            state.runStats.seals[carrinaId] = sealedAt;
        });
        inTick(() => combatCheckIfOver(combat));
      }

      it('seals the region on the first clear of its seal encounter', () => {
        seedContent([goblin, encounter(), carrina(encounterId), ...items]);
        const events = captureAnalyticsEvents();

        clearAt(40);

        expect(gamestate().runStats.seals[carrinaId]).toBe(40);
        expect(logMessages()).toContain(
          'The memory of Carrina is set in stone.',
        );
        expect(events).toContain('Progress:Seal:Carrina');
      });

      it('keeps the first tick on a refight, without logging again', () => {
        seedContent([goblin, encounter(), carrina(encounterId), ...items]);

        clearAt(90, 40);

        expect(gamestate().runStats.seals[carrinaId]).toBe(40);
        expect(logMessages()).not.toContain(
          'The memory of Carrina is set in stone.',
        );
      });

      it("ignores clears of encounters that aren't a seal", () => {
        seedContent([
          goblin,
          encounter(),
          carrina('elsewhere' as EncounterId),
          ...items,
        ]);

        clearAt(40);

        expect(gamestate().runStats.seals).toEqual({});
      });

      it('seals on an intimidation auto-win too', () => {
        seedContent([goblin, encounter(), carrina(encounterId), ...items]);
        seedGamestate((state) => (state.clock.numTicks = 25));

        inTick(() =>
          combatResolveAutoWin(fight({ encounterId, fightIndex: 0 }), true),
        );

        expect(gamestate().runStats.seals[carrinaId]).toBe(25);
      });
    });

    it('hands a random encounter to its own victory handler, keeping combat when it continues', () => {
      vi.mocked(encounterRandomHandleVictory).mockReturnValue(true);
      const combat = fight({ encounterRandomId: 'wilds' as EncounterRandomId });

      endFight(combat);

      expect(encounterRandomHandleVictory).toHaveBeenCalledWith(
        combat,
        [expect.objectContaining({ itemId: oreId, quantity: 3 })],
        [100],
      );
      expect(gamestate().world.combat).toEqual(combat);

      vi.mocked(encounterRandomHandleVictory).mockReturnValue(false);
      endFight(combat);
      expect(gamestate().world.combat).toBeUndefined();
    });

    it('hands a raid win to the raid resolver with the kill drops instead of granting them', () => {
      const combat = fight({ raidTownId: larsiaId });

      endFight(combat);

      expect(raidResolveVictory).toHaveBeenCalledWith(combat, larsiaId, [
        expect.objectContaining({ itemId: oreId, quantity: 3 }),
      ]);
      expect(gamestate().materials[oreId]).toBeUndefined();
      expect(gamestate().world.combat).toBeUndefined();
    });
  });

  describe('victory xp', () => {
    function xpAtLevel(combat: Combat): (level: number) => number {
      endFight(combat);
      return vi.mocked(partyGainXp).mock.calls[0][0];
    }

    it("scales each kill's xp against each hero's own level and the encounter cap", () => {
      const xp = xpAtLevel(fight({ encounterId, fightIndex: 0 }));
      const raw = monsterXpReward(goblin, 5);

      expect(xp(4)).toBe(xpForOverLevel(raw, 4, 5));
      expect(xp(7)).toBe(xpForOverLevel(raw, 7, 5));
      expect(xp(7)).toBeLessThan(xp(4));
    });

    it('holds xp until the last fight of the node, then pays out every held kill', () => {
      seedContent([
        goblin,
        encounter({ fights: [{ monsters: [] }, { monsters: [] }] }),
        ...items,
      ]);

      endFight(fight({ encounterId, fightIndex: 0, heldXp: [40] }));
      expect(partyGainXp).not.toHaveBeenCalled();
      expect(autoModeRecordNodeSuccess).not.toHaveBeenCalled();
      expect(autoModeRecordClauseSuccess).not.toHaveBeenCalled();
      expect(encounterStartFight).toHaveBeenCalledWith(
        encounterId,
        1,
        'Field Ruins',
        [40, 100],
        0,
      );

      const xp = xpAtLevel(fight({ encounterId, fightIndex: 1, heldXp: [40] }));
      expect(xp(4)).toBe(140);
      expect(xp(7)).toBe(xpForOverLevel(40, 7, 5) + xpForOverLevel(100, 7, 5));
      expect(autoModeRecordNodeSuccess).toHaveBeenCalledWith('Field Ruins');
    });

    it("pays out a random encounter's held xp on its last fight", () => {
      const wilds = ensureEncounterRandom({
        id: 'wilds' as EncounterRandomId,
        levelRange: { min: 3, max: 5 },
      });
      seedContent([goblin, wilds, ...items]);

      const xp = xpAtLevel(
        fight({ encounterRandomId: wilds.id, heldXp: [40] }),
      );

      expect(xp(4)).toBe(140);
    });

    it('holds xp while a random encounter has fights left', () => {
      vi.mocked(encounterRandomNextFightIndex).mockReturnValueOnce(1);
      vi.mocked(encounterRandomHandleVictory).mockReturnValueOnce(true);

      endFight(fight({ encounterRandomId: 'wilds' as EncounterRandomId }));

      expect(partyGainXp).not.toHaveBeenCalled();
      expect(encounterRandomHandleVictory).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        [100],
      );
    });

    it("caps a raid win at the town's assaulter max level", () => {
      seedContent([
        goblin,
        ensureTown({
          id: larsiaId,
          defense: {
            assaulter: { level: { min: 20, max: 25 } },
          },
        }),
      ]);

      const xp = xpAtLevel(fight({ raidTownId: larsiaId }));

      expect(xp(28)).toBe(xpForOverLevel(monsterXpReward(goblin, 5), 28, 25));
    });

    it('grants no xp for a fight with no source encounter', () => {
      expect(xpAtLevel(fight())(1)).toBe(0);
    });

    describe('xp log', () => {
      const [first, second] = [hero('hero-1'), hero('hero-2')];
      const gain = (characterId: string, xp: number) => ({
        characterId: characterId as CharacterId,
        xp,
        leveledUp: false,
      });
      const xpLines = () => logMessages().filter((line) => line.includes('XP'));
      const heroLine = (combatant: Combatant, xp: number) =>
        expect.stringContaining(
          `**${combatantMessageToken(combatant)}** gained ${xp} XP!`,
        );

      it('logs a single party line when every hero gained the same amount', () => {
        vi.mocked(partyGainXp).mockReturnValueOnce([
          gain('hero-1', 60),
          gain('hero-2', 60),
        ]);

        endFight(fight({ heroes: [first, second] }));

        expect(xpLines()).toEqual(['The party gained 60 XP!']);
      });

      it('logs one line per hero for differing amounts', () => {
        vi.mocked(partyGainXp).mockReturnValueOnce([
          gain('hero-1', 100),
          gain('hero-2', 50),
        ]);

        endFight(fight({ heroes: [first, second] }));

        expect(xpLines()).toHaveLength(2);
        expect(xpLines()).toEqual(
          expect.arrayContaining([heroLine(first, 100), heroLine(second, 50)]),
        );
      });

      it('logs a per-hero line when only some heroes gained', () => {
        vi.mocked(partyGainXp).mockReturnValueOnce([gain('hero-1', 60)]);

        endFight(fight({ heroes: [first, second] }));

        expect(xpLines()).toEqual([heroLine(first, 60)]);
      });
    });

    it('logs nothing about xp when no hero gained any', () => {
      endFight(fight());

      expect(logMessages().some((message) => message.includes('XP'))).toBe(
        false,
      );
    });

    it('wipes node failure counts only when someone levels up', () => {
      endFight(fight());
      expect(autoModeResetNodeFailureCounts).not.toHaveBeenCalled();

      vi.mocked(partyGainXp).mockReturnValueOnce([
        { characterId: 'hero-1' as CharacterId, xp: 100, leveledUp: true },
      ]);
      endFight(fight());
      expect(autoModeResetNodeFailureCounts).toHaveBeenCalled();
    });
  });

  describe('on defeat', () => {
    const lost = (overrides: Partial<Combat> = {}) =>
      fight({
        heroes: [hero('hero-1', { hp: 0 })],
        guardians: [liveGoblin()],
        ...overrides,
      });

    it('sends the party to Deaths Door, records the failure and resets combat, with no kills', () => {
      const events = captureAnalyticsEvents();
      const combat = lost();

      endFight(combat);

      expect(playGameSFX).toHaveBeenCalledWith('death');
      expect(syncPartyHpFromCombat).toHaveBeenCalledWith(combat.heroes);
      expect(travelBeginDeathsDoor).toHaveBeenCalled();
      expect(autoModeRecordClauseFailure).toHaveBeenCalled();
      expect(autoModeRecordNodeFailure).toHaveBeenCalledWith('Field Ruins');
      expect(events).toContain('Combat:Encounter:Loss');
      expect(gamestate().bestiary).toEqual({});
      expect(raidResolveDefeat).not.toHaveBeenCalled();
      expect(gamestate().world.combat).toBeUndefined();
      expect(gamestate().runStats).toMatchObject({
        fightsWon: 0,
        fightsLost: 1,
      });
    });

    it('also resolves the raid defeat for a raid loss', () => {
      endFight(lost({ raidTownId: larsiaId }));

      expect(travelBeginDeathsDoor).toHaveBeenCalled();
      expect(raidResolveDefeat).toHaveBeenCalledWith(larsiaId);
    });

    it('ends the run instead of Deaths Door when a wipe ends the run', () => {
      const events = captureAnalyticsEvents();
      const combat = lost();
      seedGamestate((state) => {
        state.world.combat = combat;
        state.globalEffectSums.wipeEndsRun = true;
      });

      inTick(() => combatCheckIfOver(combat));

      expect(travelBeginDeathsDoor).not.toHaveBeenCalled();
      expect(gamestate().meta.runLost).toBe(true);
      expect(events).toContain('Combat:Encounter:RunLost');
    });
  });
});
