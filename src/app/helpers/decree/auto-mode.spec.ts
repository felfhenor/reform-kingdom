import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/decree/decree-route');
vi.mock('@helpers/hero/travel');
vi.mock('@helpers/town/raid/town-raid-combat');

import { DECREE_PRIORITY_RECHECK_INTERVAL_TICKS } from '@helpers/config';
import { ensureGlobalEffect } from '@helpers/content/ensure-globaleffect';
import { autoModeProcessTick } from '@helpers/decree/auto-mode';
import { isGlobalEffectActive } from '@helpers/hero/global-effects';
import { applyGlobalEffectAdd } from '@helpers/hero/global-effect-state';
import { travelStart } from '@helpers/hero/travel';
import { applyMaterialDelta } from '@helpers/item/materials';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { raidEngageCombat } from '@helpers/town/raid/town-raid-combat';
import type {
  DecreeClause,
  DecreeClauseId,
  GameState,
  GatheringId,
  GlobalEffectId,
  ItemId,
} from '@interfaces';
import { buildCombat } from '@/testing/builders';
import {
  decreeClause,
  explore,
  grove,
  hurtAndWaiting,
  raidOn,
  seedDecreeWorld,
  setDecreeRoute,
  standingAt,
  stocked,
  town,
  townIdOf,
  useStubDecreeRoutes,
  withEdits,
} from '@/testing/decree';
import { inTick } from '@/testing/gamestate';

useStubDecreeRoutes();

const wood = 'wood' as ItemId;
const stick = 'stick' as ItemId;
const ore = 'copper-ore' as ItemId;
const bone = 'bone' as ItemId;

// Looked up by name, so the stored id differs on purpose.
const autoModeEffect = ensureGlobalEffect({
  id: 'auto-mode-effect' as GlobalEffectId,
  name: 'Auto Mode',
});

type Place = Parameters<typeof seedDecreeWorld>[0][number];

const world: Place[] = [
  { name: 'Kingdom', type: 'Kingdom', steps: 9 },
  { content: explore('Old Ruins', 10), steps: 2 },
  {
    content: explore('Jelly Fields', 10, 10, { completionRewards: [] }),
    steps: 3,
  },
  { content: grove('Wergen Woods', [wood, stick]), steps: 1 },
  { content: grove('Copper Mines', [ore]), steps: 4 },
  { content: town('Larsia', 1), steps: 5 },
  { content: town('Vesper', 1) },
  { content: grove('Deep Mine', [ore]) },
];

const gatherWood = decreeClause(
  { type: 'GatherMaterial', materialId: wood, targetQuantity: 50 },
  { id: 'wood' as DecreeClauseId },
);
const gatherStick = decreeClause(
  { type: 'GatherMaterial', materialId: stick, targetQuantity: 50 },
  { id: 'stick' as DecreeClauseId },
);
const gatherOre = decreeClause(
  { type: 'GatherMaterial', materialId: ore, targetQuantity: 30 },
  { id: 'ore' as DecreeClauseId },
);
const farm = (nodeName: string) =>
  decreeClause(
    {
      type: 'FarmNode',
      nodeName,
      reward: { itemId: bone },
      targetQuantity: 10,
    },
    { id: 'farm' as DecreeClauseId },
  );
const farmJelly = farm('Jelly Fields');
const finishAreas = decreeClause(
  { type: 'FinishUnfinishedAreas', riskTolerance: 'High' },
  { id: 'finish' as DecreeClauseId },
);
const defendTowns = decreeClause(
  { type: 'DefendTowns', riskTolerance: 'High' },
  { id: 'defend' as DecreeClauseId },
);

const atTick = (numTicks: number) => (state: GameState) =>
  (state.clock.numTicks = numTicks);

// Off the recheck interval, so a first tick only reacts to the decree edit it sees.
const offInterval = atTick(1);

function seedAutoMode(
  clauses: DecreeClause[],
  {
    active,
    gatheringAt,
    travelingTo,
    edit,
    places = world,
  }: {
    active?: DecreeClause;
    gatheringAt?: string;
    travelingTo?: string;
    edit?: (state: GameState) => void;
    places?: Place[];
  } = {},
): void {
  seedDecreeWorld(
    places,
    (state) => {
      offInterval(state);
      state.world.autoMode.enabled = true;
      state.world.autoMode.clauses = clauses;
      state.world.autoMode.activeClauseId = active?.id;
      if (gatheringAt) {
        state.world.gathering = {
          status: 'Gathering',
          nodeName: gatheringAt,
          gatheringId: gatheringAt as GatheringId,
          ticksIntoGather: 0,
        };
      }
      if (travelingTo) {
        state.world.travel = {
          status: 'Traveling',
          destinationNodeName: travelingTo,
          path: [],
          ticksIntoStep: 0,
        };
      }
      edit?.(state);
    },
    [autoModeEffect],
  );
}

const tick = () => inTick(() => autoModeProcessTick());
const autoMode = () => gamestate().world.autoMode;
const gathering = () => gamestate().world.gathering;

// Changes state without replacing the clause list, so the tick doesn't see a decree edit.
function nudge(edit: (state: GameState) => void): void {
  inTick(() =>
    updateGamestate((state) => {
      edit(state);
      return state;
    }),
  );
}

beforeEach(() => {
  vi.mocked(travelStart).mockClear();
  vi.mocked(raidEngageCombat).mockReset();
});

describe('the Auto Mode global effect', () => {
  it('is granted once enabled and kept without stacking', () => {
    seedAutoMode([]);

    tick();
    tick();

    expect(isGlobalEffectActive(autoModeEffect.name as GlobalEffectId)).toBe(
      true,
    );
    expect(gamestate().globalEffects).toHaveLength(1);
  });

  it('is removed once disabled, with nothing else done', () => {
    seedAutoMode([finishAreas], {
      gatheringAt: 'Wergen Woods',
      edit: (state) => {
        state.world.autoMode.enabled = false;
        applyGlobalEffectAdd(state, autoModeEffect.id, 100, 0);
      },
    });

    tick();

    expect(gamestate().globalEffects).toEqual([]);
    expect(gathering().status).toBe('Gathering');
    expect(travelStart).not.toHaveBeenCalled();
  });
});

describe('picking a clause while idle', () => {
  it('travels to the top clause’s target and tracks it as active', () => {
    seedAutoMode([gatherOre, finishAreas], {
      edit: stocked(ore, gatherOre.targetQuantity),
    });

    tick();

    expect(travelStart).toHaveBeenCalledExactlyOnceWith('Old Ruins', true);
    expect(autoMode().activeClauseId).toBe(finishAreas.id);
  });

  it('heads for the gateway of a target walled in behind it', () => {
    seedAutoMode([finishAreas], {
      places: [
        { content: explore('Spider Tower', 10), steps: 3, via: 'Waystation' },
        { content: explore('Waystation', 10, 10, { completionRewards: [] }) },
      ],
    });

    tick();

    expect(travelStart).toHaveBeenCalledExactlyOnceWith('Waystation', true);
  });

  it('does nothing mid-combat', () => {
    seedAutoMode([finishAreas], {
      edit: (state) => (state.world.combat = buildCombat()),
    });

    tick();

    expect(travelStart).not.toHaveBeenCalled();
  });

  it('heads home when nothing is left to do, unless already there', () => {
    seedAutoMode([gatherOre], { edit: stocked(ore, gatherOre.targetQuantity) });
    tick();
    expect(travelStart).toHaveBeenCalledExactlyOnceWith('Kingdom', true);

    vi.mocked(travelStart).mockClear();
    seedAutoMode([gatherOre], {
      edit: withEdits(
        stocked(ore, gatherOre.targetQuantity),
        standingAt('Kingdom'),
      ),
    });
    tick();
    expect(travelStart).not.toHaveBeenCalled();
  });

  it('heads home through the gateway it is walled in behind', () => {
    seedAutoMode([], {
      places: [
        { name: 'Kingdom', type: 'Kingdom', steps: 3, via: 'Waystation' },
        { content: explore('Waystation', 10, 10, { completionRewards: [] }) },
      ],
    });

    tick();

    expect(travelStart).toHaveBeenCalledExactlyOnceWith('Waystation', true);
  });

  it('stays put to heal when the top clause is only waiting on health', () => {
    seedAutoMode([finishAreas, gatherOre], {
      active: finishAreas,
      edit: hurtAndWaiting,
    });

    tick();

    expect(travelStart).not.toHaveBeenCalled();
    expect(autoMode().activeClauseId).toBeUndefined();
  });
});

describe('DefendTowns', () => {
  const defendFrom = (nodeName: string, clause: DecreeClause = defendTowns) =>
    seedAutoMode([clause], {
      active: clause,
      edit: withEdits(raidOn('Larsia', 'Vesper'), standingAt(nodeName)),
    });

  it('engages the raid once standing at the target town', () => {
    vi.mocked(raidEngageCombat).mockReturnValue(true);
    defendFrom('Larsia');

    tick();

    expect(raidEngageCombat).toHaveBeenCalledExactlyOnceWith(
      townIdOf('Larsia'),
    );
    expect(travelStart).not.toHaveBeenCalled();
  });

  it('travels to the target first, even from another raided town', () => {
    defendFrom('Vesper');

    tick();

    expect(raidEngageCombat).not.toHaveBeenCalled();
    expect(travelStart).toHaveBeenCalledExactlyOnceWith('Larsia', true);
  });

  it('carries on with normal dispatch when the engage is refused', () => {
    defendFrom('Larsia');

    tick();

    expect(raidEngageCombat).toHaveBeenCalled();
    expect(travelStart).toHaveBeenCalledExactlyOnceWith('Larsia', true);
  });

  it('never engages for another clause targeting a raided town', () => {
    defendFrom('Larsia', farm('Larsia'));

    tick();

    expect(raidEngageCombat).not.toHaveBeenCalled();
  });
});

describe('gathering for a GatherMaterial clause', () => {
  it('stops once the target is reached, and only then', () => {
    seedAutoMode([gatherWood], {
      active: gatherWood,
      gatheringAt: 'Wergen Woods',
      edit: stocked(wood, gatherWood.targetQuantity - 1),
    });
    tick();
    expect(gathering().status).toBe('Gathering');

    nudge(stocked(wood, 1));
    tick();
    expect(gathering().status).toBe('Idle');
  });

  it('only ends a gather that is actually running', () => {
    seedAutoMode([gatherWood], {
      active: gatherWood,
      travelingTo: 'Wergen Woods',
      edit: stocked(wood, gatherWood.targetQuantity),
    });

    tick();

    expect(autoMode().activeClauseId).toBe(gatherWood.id);
  });

  it('adopts an untracked gather that an enabled clause wants, so it still stops at the target', () => {
    seedAutoMode([gatherWood], {
      gatheringAt: 'Wergen Woods',
      edit: stocked(wood, gatherWood.targetQuantity - 1),
    });
    tick();
    expect(autoMode().activeClauseId).toBe(gatherWood.id);
    expect(gathering().status).toBe('Gathering');

    nudge(stocked(wood, 1));
    tick();
    expect(gathering().status).toBe('Idle');
  });

  it('adopts a clause pinned to the node being gathered, but not one pinned elsewhere', () => {
    const pinned = (nodeName: string) => ({ ...gatherWood, nodeName });

    seedAutoMode([pinned('Wergen Woods')], { gatheringAt: 'Wergen Woods' });
    tick();
    expect(autoMode().activeClauseId).toBe(gatherWood.id);
    expect(gathering().status).toBe('Gathering');

    seedAutoMode([pinned('Other Woods')], { gatheringAt: 'Wergen Woods' });
    tick();
    expect(autoMode().activeClauseId).toBeUndefined();
    expect(gathering().status).toBe('Idle');
  });

  it('never adopts a clause for a material the node doesn’t yield, even pinned there', () => {
    seedAutoMode([{ ...gatherOre, nodeName: 'Wergen Woods' }], {
      gatheringAt: 'Wergen Woods',
    });

    tick();

    expect(gathering().status).toBe('Idle');
  });

  it('keeps tracking its own clause rather than re-adopting a higher one at the same node', () => {
    seedAutoMode([gatherWood, gatherStick], {
      active: gatherStick,
      gatheringAt: 'Wergen Woods',
      edit: stocked(wood, gatherWood.targetQuantity),
    });

    tick();

    expect(gathering().status).toBe('Gathering');
    expect(autoMode().activeClauseId).toBe(gatherStick.id);
  });

  it('leaves a tracked gather short of its target alone, even while hurt and waiting', () => {
    seedAutoMode([gatherWood], {
      active: gatherWood,
      gatheringAt: 'Wergen Woods',
      edit: hurtAndWaiting,
    });

    tick();

    expect(gathering().status).toBe('Gathering');
    expect(travelStart).not.toHaveBeenCalled();
  });
});

describe('an orphaned gather', () => {
  it('is stopped when the only clause wanting it is disabled, or none wants it', () => {
    for (const clauses of [[{ ...gatherWood, enabled: false }], [gatherOre]]) {
      seedAutoMode(clauses, { gatheringAt: 'Wergen Woods' });

      tick();

      expect(gathering().status).toBe('Idle');
    }
  });

  it('is stopped and replaced by the next clause in the same tick', () => {
    seedAutoMode([finishAreas], { gatheringAt: 'Wergen Woods' });

    tick();

    expect(gathering().status).toBe('Idle');
    expect(travelStart).toHaveBeenCalledExactlyOnceWith('Old Ruins', true);
  });

  it('is stopped for a heal trip home when hurt and waiting, even with other work to do', () => {
    seedAutoMode([gatherOre], {
      gatheringAt: 'Wergen Woods',
      edit: hurtAndWaiting,
    });

    tick();

    expect(gathering().status).toBe('Idle');
    expect(travelStart).toHaveBeenCalledExactlyOnceWith('Kingdom', true);
  });

  it('is not a reason to go home for a hurt party that isn’t set to wait', () => {
    seedAutoMode([finishAreas], {
      gatheringAt: 'Wergen Woods',
      edit: (state) => state.world.party.forEach((hero) => (hero.hp = 0)),
    });

    tick();

    expect(travelStart).toHaveBeenCalledExactlyOnceWith('Old Ruins', true);
  });

  it('includes one whose active clause was disabled mid-session', () => {
    const disabled = { ...gatherWood, enabled: false };
    seedAutoMode([disabled], { active: disabled, gatheringAt: 'Wergen Woods' });

    tick();

    expect(gathering().status).toBe('Idle');
  });
});

describe('a decree edit mid-action', () => {
  it('abandons a gather when a reorder puts a clause with another target on top', () => {
    seedAutoMode([gatherOre, gatherWood], {
      active: gatherWood,
      gatheringAt: 'Wergen Woods',
    });

    tick();

    expect(gathering().status).toBe('Idle');
    expect(travelStart).toHaveBeenCalledExactlyOnceWith('Copper Mines', true);
    expect(autoMode().activeClauseId).toBe(gatherOre.id);
  });

  it('abandons a gather when the active clause is edited in place to want something else', () => {
    seedAutoMode([{ ...gatherWood, materialId: ore }], {
      active: gatherWood,
      gatheringAt: 'Wergen Woods',
    });

    tick();

    expect(gathering().status).toBe('Idle');
    expect(travelStart).toHaveBeenCalledExactlyOnceWith('Copper Mines', true);
  });

  it('hands tracking to a new top clause at the same node without restarting the gather', () => {
    seedAutoMode([gatherStick, gatherWood], {
      active: gatherWood,
      gatheringAt: 'Wergen Woods',
    });

    tick();

    expect(gathering().status).toBe('Gathering');
    expect(travelStart).not.toHaveBeenCalled();
    expect(autoMode().activeClauseId).toBe(gatherStick.id);
  });

  it('redirects travel already underway', () => {
    seedAutoMode([gatherOre, farmJelly], {
      active: farmJelly,
      travelingTo: 'Jelly Fields',
    });

    tick();

    expect(travelStart).toHaveBeenCalledExactlyOnceWith('Copper Mines', true);
  });

  it('lets an untracked trip home finish first', () => {
    seedAutoMode([finishAreas], { travelingTo: 'Kingdom' });

    tick();

    expect(travelStart).not.toHaveBeenCalled();
  });

  it('changes nothing while the active clause stays on top with the same target', () => {
    seedAutoMode([gatherWood], {
      active: gatherWood,
      gatheringAt: 'Wergen Woods',
    });

    tick();

    expect(gathering().status).toBe('Gathering');
    expect(travelStart).not.toHaveBeenCalled();
  });

  it('never interrupts combat', () => {
    seedAutoMode([gatherOre, gatherWood], {
      active: gatherWood,
      travelingTo: 'Wergen Woods',
      edit: (state) => (state.world.combat = buildCombat()),
    });

    tick();

    expect(travelStart).not.toHaveBeenCalled();
    expect(autoMode().activeClauseId).toBe(gatherWood.id);
  });

  it('pauses a gather to heal for a higher clause only waiting on health', () => {
    seedAutoMode([finishAreas, gatherWood], {
      active: gatherWood,
      gatheringAt: 'Wergen Woods',
      edit: hurtAndWaiting,
    });

    tick();

    expect(gathering().status).toBe('Idle');
    expect(travelStart).not.toHaveBeenCalled();
    expect(autoMode().activeClauseId).toBeUndefined();
  });

  it('keeps traveling for a higher clause only waiting on health', () => {
    seedAutoMode([finishAreas, gatherWood], {
      active: gatherWood,
      travelingTo: 'Wergen Woods',
      edit: hurtAndWaiting,
    });

    tick();

    expect(travelStart).not.toHaveBeenCalled();
    expect(autoMode().activeClauseId).toBe(gatherWood.id);
  });
});

describe('the periodic priority recheck while gathering', () => {
  // The farm clause has nothing to do until its reward stock drops below target.
  function seedFarmBlocked(travelingTo?: string): void {
    seedAutoMode([farmJelly, gatherWood], {
      active: gatherWood,
      gatheringAt: travelingTo ? undefined : 'Wergen Woods',
      travelingTo,
      edit: stocked(bone, farmJelly.targetQuantity),
    });
    tick();
  }
  const farmNeeded = (state: GameState) =>
    applyMaterialDelta(state, bone, -farmJelly.targetQuantity);

  it('abandons the gather once a higher clause becomes actionable', () => {
    seedFarmBlocked();

    nudge(
      withEdits(farmNeeded, atTick(DECREE_PRIORITY_RECHECK_INTERVAL_TICKS)),
    );
    tick();

    expect(gathering().status).toBe('Idle');
    expect(travelStart).toHaveBeenCalledExactlyOnceWith('Jelly Fields', true);
  });

  it('waits for the next interval', () => {
    seedFarmBlocked();

    nudge(
      withEdits(farmNeeded, atTick(DECREE_PRIORITY_RECHECK_INTERVAL_TICKS + 1)),
    );
    tick();

    expect(gathering().status).toBe('Gathering');
    expect(travelStart).not.toHaveBeenCalled();
  });

  it('skips travel, which re-resolves on arrival anyway', () => {
    seedFarmBlocked('Wergen Woods');

    nudge(
      withEdits(farmNeeded, atTick(DECREE_PRIORITY_RECHECK_INTERVAL_TICKS)),
    );
    tick();

    expect(travelStart).not.toHaveBeenCalled();
  });

  it('ignores the active clause’s own target moving as the party moves', () => {
    seedAutoMode([gatherOre], {
      active: gatherOre,
      gatheringAt: 'Copper Mines',
    });
    tick();
    setDecreeRoute('Deep Mine', 1);

    nudge(atTick(DECREE_PRIORITY_RECHECK_INTERVAL_TICKS));
    tick();

    expect(gathering().status).toBe('Gathering');
    expect(travelStart).not.toHaveBeenCalled();
  });
});
