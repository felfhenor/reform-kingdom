import { describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/decree/decree-route');

import {
  CHARACTER_MAX_LEVEL,
  LEVEL_UP_NODE_FAILURE_LIMIT,
  OVERLEVEL_XP_HARD_CAP_LEVELS,
} from '@helpers/config';
import { ensureDroppedReward } from '@helpers/content/ensure-helpers-drops';
import {
  clauseTargetNode,
  clauseTravelNode,
  isClauseBlockedOnlyByHealth,
  isClauseSatisfiable,
  mostChallengingExploreNodeForRisk,
  nearestGatherNodeFor,
  nearestUnfinishedExploreNode,
  pickTopPriorityClause,
  riskLevelOfExploreNode,
  riskLevelSatisfies,
} from '@helpers/decree/decree-evaluation';
import { applyCollectibleGrant } from '@helpers/item/collectibles';
import type {
  CollectibleId,
  DecreeClauseId,
  GameState,
  ItemId,
} from '@interfaces';
import { buildCharacter } from '@/testing/builders';
import {
  decreeClause,
  explore,
  grove,
  hurtAndWaiting,
  mystical,
  mysticalUp,
  nodeFailures,
  partyAt,
  raidOn,
  seedDecreeWorld,
  standingAt,
  stocked,
  town,
  useStubDecreeRoutes,
  withEdits,
} from '@/testing/decree';

useStubDecreeRoutes();

const wood = 'wood' as ItemId;
const stone = 'stone' as ItemId;
const bone = 'bone' as ItemId;

const found = 'found-gem' as CollectibleId;
const looted = (state: GameState) => applyCollectibleGrant(state, found, 1);

const finish = decreeClause({
  type: 'FinishUnfinishedAreas',
  riskTolerance: 'Medium',
});
const levelUp = decreeClause({ type: 'LevelUpParty', riskTolerance: 'High' });
const goHome = decreeClause({ type: 'ReturnToKingdom' });
const farm = (nodeName = 'Forest Ruins') =>
  decreeClause({
    type: 'FarmNode',
    nodeName,
    reward: { itemId: bone },
    targetQuantity: 5,
  });

describe('riskLevelOfExploreNode', () => {
  it('rates a node by its level range against the weakest hero', () => {
    const { Cave, Ruins } = seedDecreeWorld(
      [{ content: explore('Cave', 8, 12) }, { content: mystical('Ruins', 9) }],
      partyAt(10, 30),
    );

    expect(riskLevelOfExploreNode(Cave)).toBe('Medium');
    expect(riskLevelOfExploreNode(Ruins)).toBe('Low');
  });

  it('is TooHigh for a node with no encounter content', () => {
    const { Signpost } = seedDecreeWorld([
      { name: 'Signpost', type: 'ExploreNode' },
    ]);

    expect(riskLevelOfExploreNode(Signpost)).toBe('TooHigh');
  });
});

describe('riskLevelSatisfies', () => {
  it('accepts a band at or below the ceiling, never TooHigh', () => {
    expect(riskLevelSatisfies('Low', 'High')).toBe(true);
    expect(riskLevelSatisfies('Medium', 'Medium')).toBe(true);
    expect(riskLevelSatisfies('High', 'Medium')).toBe(false);
    expect(riskLevelSatisfies('TooHigh', 'High')).toBe(false);
  });
});

describe('nearestUnfinishedExploreNode', () => {
  it('picks the reachable unfinished node with the shortest path', () => {
    const { Near } = seedDecreeWorld([
      { content: explore('Far', 1), steps: 2 },
      { content: explore('Near', 1), steps: 1 },
      { content: explore('Unreachable', 1) },
    ]);

    expect(nearestUnfinishedExploreNode('High')).toEqual(Near);
  });

  it('keeps the first of equally near nodes', () => {
    const nodes = seedDecreeWorld([
      { content: explore('First', 1), steps: 2 },
      { content: explore('Second', 1), steps: 2 },
    ]);

    expect(nearestUnfinishedExploreNode('High')).toEqual(nodes['First']);
  });

  it('skips nodes fully looted, too risky, or hidden and undiscovered', () => {
    seedDecreeWorld(
      [
        { content: explore('Done', 1, 1, { completionRewards: [] }), steps: 1 },
        {
          content: explore('Looted', 1, 1, {
            completionRewards: [
              ensureDroppedReward({ collectibleId: found, chance: 1 }),
            ],
          }),
          steps: 1,
        },
        { content: explore('Risky', 30), steps: 1 },
        { content: explore('Hidden', 1, 1, { hidden: true }), steps: 1 },
      ],
      looted,
    );
    expect(nearestUnfinishedExploreNode('High')).toBeUndefined();
  });

  it('includes a hidden node once discovered', () => {
    const { Hidden } = seedDecreeWorld(
      [{ content: explore('Hidden', 1, 1, { hidden: true }), steps: 1 }],
      (state) => (state.worldDiscoveries['Hidden'] = { foundAt: 1 }),
    );

    expect(nearestUnfinishedExploreNode('High')).toEqual(Hidden);
  });

  describe('mystical nodes', () => {
    it('picks one whose fights are up with rewards missing', () => {
      const { Ruins } = seedDecreeWorld(
        [{ content: mystical('Ruins', 1), steps: 1 }],
        mysticalUp('Ruins'),
      );

      expect(nearestUnfinishedExploreNode('High')).toEqual(Ruins);
    });

    it('skips one fully looted, cleared this cycle, not yet rolled, or too risky', () => {
      seedDecreeWorld(
        [
          {
            content: mystical('Looted', 1, { completionRewards: [] }),
            steps: 1,
          },
          { content: mystical('Cleared', 1), steps: 1 },
          { content: mystical('Unrolled', 1), steps: 1 },
          { content: mystical('Risky', 30), steps: 1 },
        ],
        withEdits(
          mysticalUp('Looted'),
          mysticalUp('Cleared', true),
          mysticalUp('Risky'),
        ),
      );

      expect(nearestUnfinishedExploreNode('High')).toBeUndefined();
    });

    it('competes with fixed nodes on distance', () => {
      const nearer = seedDecreeWorld(
        [
          { content: explore('Cave', 1), steps: 2 },
          { content: mystical('Ruins', 1), steps: 1 },
        ],
        mysticalUp('Ruins'),
      );
      expect(nearestUnfinishedExploreNode('High')).toEqual(nearer['Ruins']);

      const farther = seedDecreeWorld(
        [
          { content: explore('Cave', 1), steps: 2 },
          { content: mystical('Ruins', 1), steps: 3 },
        ],
        mysticalUp('Ruins'),
      );
      expect(nearestUnfinishedExploreNode('High')).toEqual(farther['Cave']);
    });
  });
});

type Place = Parameters<typeof seedDecreeWorld>[0][number];

describe('a node walled in behind another node', () => {
  function walledIn(gateway: Place, edit?: (state: GameState) => void) {
    return seedDecreeWorld(
      [
        {
          content: explore('Spider Tower', 10),
          steps: 3,
          via: 'Slimed Waystation',
        },
        { name: 'Slimed Waystation', ...gateway },
      ],
      edit,
    );
  }
  const fightingGateway = (min: number): Place => ({
    content: explore('Slimed Waystation', min, min, { completionRewards: [] }),
  });

  it('is still an unfinished area, reached by heading to the gateway first', () => {
    const nodes = walledIn(fightingGateway(10));

    expect(nearestUnfinishedExploreNode('Medium')).toEqual(
      nodes['Spider Tower'],
    );
    expect(clauseTravelNode(finish)).toEqual(nodes['Slimed Waystation']);
  });

  it('is skipped when the gateway fight exceeds the risk tolerance', () => {
    const nodes = walledIn(fightingGateway(15));
    expect(nearestUnfinishedExploreNode('Medium')).toBeUndefined();
    expect(nearestUnfinishedExploreNode('High')).toEqual(nodes['Spider Tower']);

    walledIn(fightingGateway(30));
    expect(nearestUnfinishedExploreNode('High')).toBeUndefined();
  });

  it('is gathered or farmed past a high-risk gateway', () => {
    const nodes = seedDecreeWorld([
      {
        content: grove('Spider Tower', [wood]),
        steps: 3,
        via: 'Slimed Waystation',
      },
      {
        content: explore('Forest Ruins', 1),
        steps: 3,
        via: 'Slimed Waystation',
      },
      { name: 'Slimed Waystation', ...fightingGateway(15) },
    ]);

    expect(nearestGatherNodeFor(wood)).toEqual(nodes['Spider Tower']);
    expect(clauseTargetNode(farm())).toEqual(nodes['Forest Ruins']);
  });

  it('is skipped when stopping at the gateway would start a gather or a mystical fight', () => {
    walledIn({ content: grove('Slimed Waystation', [wood]) });
    expect(nearestUnfinishedExploreNode('High')).toBeUndefined();

    walledIn({ content: mystical('Slimed Waystation', 1) });
    expect(nearestUnfinishedExploreNode('High')).toBeUndefined();
  });

  it('is skipped while the gateway is hidden', () => {
    walledIn({
      content: explore('Slimed Waystation', 10, 10, {
        completionRewards: [],
        hidden: true,
      }),
    });

    expect(nearestUnfinishedExploreNode('High')).toBeUndefined();
  });

  it('is reached past a gateway with nothing to fight at any risk tolerance', () => {
    const nodes = walledIn({ type: 'ExploreNode' });

    expect(nearestUnfinishedExploreNode('Low')).toEqual(nodes['Spider Tower']);
  });

  it('is reached by LevelUpParty too', () => {
    const nodes = walledIn(fightingGateway(10));

    expect(mostChallengingExploreNodeForRisk('High')).toEqual(
      nodes['Spider Tower'],
    );
    expect(clauseTravelNode(levelUp)).toEqual(nodes['Slimed Waystation']);
  });

  it('is left through the gateway when home is inside it', () => {
    const nodes = seedDecreeWorld([
      { name: 'Kingdom', type: 'Kingdom', steps: 3, via: 'Slimed Waystation' },
      { name: 'Slimed Waystation', ...fightingGateway(10) },
    ]);

    expect(clauseTravelNode(goHome)).toEqual(nodes['Slimed Waystation']);
  });

  it('lets a clause with no risk setting fight through a high-risk gateway', () => {
    const nodes = seedDecreeWorld([
      {
        content: grove('Spider Tower', [wood]),
        steps: 3,
        via: 'Slimed Waystation',
      },
      { name: 'Slimed Waystation', ...fightingGateway(15) },
    ]);

    expect(
      clauseTravelNode(
        decreeClause({
          type: 'GatherMaterial',
          materialId: wood,
          nodeName: 'Spider Tower',
          targetQuantity: 5,
        }),
      ),
    ).toEqual(nodes['Slimed Waystation']);
  });

  it('lets DefendTowns fight through a gateway riskier than the raid tolerance', () => {
    const nodes = seedDecreeWorld(
      [
        { content: town('Larsia', 20, 25), steps: 3, via: 'Slimed Waystation' },
        { name: 'Slimed Waystation', ...fightingGateway(30) },
      ],
      withEdits(raidOn('Larsia'), partyAt(25)),
    );
    [undefined, 'Larsia'].forEach((townName) => {
      const defend = decreeClause({
        type: 'DefendTowns',
        riskTolerance: 'Low',
        townName,
      });

      expect(clauseTargetNode(defend)).toEqual(nodes['Larsia']);
      expect(clauseTravelNode(defend)).toEqual(nodes['Slimed Waystation']);
    });
  });

  it('counts gateway losses against it for LevelUpParty', () => {
    const nodes = seedDecreeWorld(
      [
        {
          content: explore('Spider Tower', 10),
          steps: 3,
          via: 'Slimed Waystation',
        },
        { name: 'Slimed Waystation', ...fightingGateway(10) },
        { content: explore('Open Field', 9), steps: 1 },
      ],
      nodeFailures({ 'Slimed Waystation': LEVEL_UP_NODE_FAILURE_LIMIT }),
    );

    expect(mostChallengingExploreNodeForRisk('High')).toEqual(
      nodes['Open Field'],
    );
  });

  it('is traveled to directly once reachable', () => {
    const nodes = seedDecreeWorld([
      { content: explore('Spider Tower', 10), steps: 3 },
    ]);

    expect(clauseTravelNode(finish)).toEqual(nodes['Spider Tower']);
  });
});

describe('mostChallengingExploreNodeForRisk', () => {
  it('prefers the most challenging reachable node within the risk tolerance, regardless of distance', () => {
    const nodes = seedDecreeWorld([
      { content: explore('Near', 7), steps: 1 },
      { content: explore('Far', 10), steps: 3 },
      { content: explore('Unreachable', 9, 11) },
      { content: explore('Risky', 16), steps: 1 },
      { content: explore('Hidden', 9, 11, { hidden: true }), steps: 1 },
    ]);

    expect(mostChallengingExploreNodeForRisk('Medium')).toEqual(nodes['Far']);
    expect(mostChallengingExploreNodeForRisk('Low')).toEqual(nodes['Far']);
  });

  it('ranks by the toughest fight a node can throw', () => {
    const nodes = seedDecreeWorld([
      { content: explore('Steady', 10), steps: 1 },
      { content: explore('Swingy', 5, 12), steps: 1 },
    ]);

    expect(mostChallengingExploreNodeForRisk('Medium')).toEqual(
      nodes['Swingy'],
    );
  });

  it('ignores mystical nodes', () => {
    seedDecreeWorld(
      [{ content: mystical('Ruins', 10), steps: 1 }],
      mysticalUp('Ruins'),
    );

    expect(mostChallengingExploreNodeForRisk('High')).toBeUndefined();
  });

  it('prefers a same-tier node with fewer failures over one that keeps losing', () => {
    const nodes = seedDecreeWorld(
      [
        { content: explore('Losing', 10), steps: 1 },
        { content: explore('Comparable', 10), steps: 1 },
      ],
      nodeFailures({ Losing: 2 }),
    );

    expect(mostChallengingExploreNodeForRisk('High')).toEqual(
      nodes['Comparable'],
    );
  });

  it('steps down a tier once every node in it has hit the failure limit', () => {
    const nodes = seedDecreeWorld(
      [
        { content: explore('Hard', 10), steps: 1 },
        { content: explore('Middling', 8), steps: 1 },
        { content: explore('Easy', 7), steps: 1 },
      ],
      nodeFailures({
        Hard: LEVEL_UP_NODE_FAILURE_LIMIT,
        Middling: LEVEL_UP_NODE_FAILURE_LIMIT - 1,
      }),
    );

    expect(mostChallengingExploreNodeForRisk('High')).toEqual(
      nodes['Middling'],
    );
  });

  it('falls back to the least-failed node overall once every tier has hit the limit', () => {
    const nodes = seedDecreeWorld(
      [
        { content: explore('Hard', 10), steps: 1 },
        { content: explore('Easy', 8), steps: 1 },
      ],
      nodeFailures({
        Hard: LEVEL_UP_NODE_FAILURE_LIMIT + 3,
        Easy: LEVEL_UP_NODE_FAILURE_LIMIT,
      }),
    );

    expect(mostChallengingExploreNodeForRisk('High')).toEqual(nodes['Easy']);
  });

  it('excludes nodes the weakest hero has outgrown, and only those', () => {
    const weakest = 1 + OVERLEVEL_XP_HARD_CAP_LEVELS;
    const nodes = seedDecreeWorld(
      [
        { content: explore('Trivial', 1), steps: 1 },
        { content: explore('Worthwhile', 2), steps: 2 },
      ],
      partyAt(weakest, weakest + 20),
    );

    expect(mostChallengingExploreNodeForRisk('High')).toEqual(
      nodes['Worthwhile'],
    );

    seedDecreeWorld(
      [{ content: explore('Trivial', 1), steps: 1 }],
      partyAt(weakest),
    );
    expect(mostChallengingExploreNodeForRisk('High')).toBeUndefined();
  });
});

describe('nearestGatherNodeFor', () => {
  it('picks the nearest discovered, visible node yielding the material', () => {
    const nodes = seedDecreeWorld(
      [
        { content: grove('Far Grove', [wood]), steps: 3 },
        { content: grove('Grove', [wood]), steps: 2 },
        { content: grove('Quarry', [stone]), steps: 1 },
        { content: grove('Undiscovered', [wood]), steps: 1 },
        { content: grove('Hidden', [wood], { hidden: true }), steps: 1 },
      ],
      (state) => delete state.discoveredGatherNodes['Undiscovered'],
    );

    expect(nearestGatherNodeFor(wood)).toEqual(nodes['Grove']);
    expect(nearestGatherNodeFor(bone)).toBeUndefined();
  });
});

describe('clauseTargetNode', () => {
  const gatherAt = (nodeName?: string) =>
    decreeClause({
      type: 'GatherMaterial',
      materialId: wood,
      nodeName,
      targetQuantity: 10,
    });

  it('targets a GatherMaterial clause’s pinned node, whatever it yields', () => {
    const nodes = seedDecreeWorld([
      { content: grove('Quarry', [stone]), steps: 2 },
      { content: grove('Grove', [wood]), steps: 1 },
    ]);

    expect(clauseTargetNode(gatherAt('Quarry'))).toEqual(nodes['Quarry']);
  });

  it('falls back to the nearest node for a GatherMaterial clause saved without a pinned node', () => {
    const nodes = seedDecreeWorld([
      { content: grove('Grove', [wood]), steps: 1 },
    ]);

    expect(clauseTargetNode(gatherAt())).toEqual(nodes['Grove']);
  });

  it('has no target for a pinned node that is gone, unreachable, or hidden', () => {
    seedDecreeWorld([
      { content: grove('Unreachable', [wood]) },
      { content: grove('Hidden', [wood], { hidden: true }), steps: 1 },
    ]);

    for (const name of ['Gone', 'Unreachable', 'Hidden']) {
      expect(clauseTargetNode(gatherAt(name))).toBeUndefined();
      expect(clauseTargetNode(farm(name))).toBeUndefined();
    }
  });

  it('targets a FarmNode clause’s node', () => {
    const nodes = seedDecreeWorld([
      {
        content: explore('Forest Ruins', 1, 1, { completionRewards: [] }),
        steps: 1,
      },
    ]);

    expect(clauseTargetNode(farm())).toEqual(nodes['Forest Ruins']);
  });

  it('targets a mystical FarmNode only while its fights are up', () => {
    const places = [{ content: mystical('Forest Ruins', 1), steps: 1 }];

    const nodes = seedDecreeWorld(places, mysticalUp('Forest Ruins'));
    expect(clauseTargetNode(farm())).toEqual(nodes['Forest Ruins']);
    expect(isClauseSatisfiable(farm())).toBe(true);

    seedDecreeWorld(places, mysticalUp('Forest Ruins', true));
    expect(clauseTargetNode(farm())).toBeUndefined();
    expect(isClauseSatisfiable(farm())).toBe(false);
  });

  it('has no node target for ReturnToKingdom', () => {
    seedDecreeWorld([{ name: 'Kingdom', type: 'Kingdom', steps: 1 }]);

    expect(clauseTargetNode(goHome)).toBeUndefined();
  });

  describe('DefendTowns', () => {
    const defend = (riskTolerance: 'Low' | 'High', townName?: string) =>
      decreeClause({ type: 'DefendTowns', riskTolerance, townName });

    it('targets a named town while it is raided, reachable and within the risk tolerance', () => {
      const places = [{ content: town('Larsia', 20, 25), steps: 1 }];

      const nodes = seedDecreeWorld(
        places,
        withEdits(raidOn('Larsia'), partyAt(25)),
      );
      expect(clauseTargetNode(defend('Low', 'Larsia'))).toEqual(
        nodes['Larsia'],
      );

      seedDecreeWorld(places, partyAt(25));
      expect(clauseTargetNode(defend('Low', 'Larsia'))).toBeUndefined();

      seedDecreeWorld(places, withEdits(raidOn('Larsia'), partyAt(1)));
      expect(clauseTargetNode(defend('High', 'Larsia'))).toBeUndefined();

      seedDecreeWorld(
        [{ content: town('Larsia', 20, 25) }],
        withEdits(raidOn('Larsia'), partyAt(25)),
      );
      expect(clauseTargetNode(defend('Low', 'Larsia'))).toBeUndefined();
    });

    it('otherwise picks the nearest reachable raided town within the risk tolerance', () => {
      const nodes = seedDecreeWorld(
        [
          { content: town('Far', 20, 25), steps: 2 },
          { content: town('Near', 20, 25), steps: 1 },
          { content: town('Nearest', 20, 25) },
          { content: town('Risky', 26), steps: 1 },
          { content: town('Calm', 20, 25), steps: 1 },
          {
            content: town('Hidden', 20, 25, { hidden: true }),
            steps: 0,
          },
        ],
        withEdits(
          raidOn('Far', 'Near', 'Nearest', 'Risky', 'Hidden'),
          partyAt(25),
        ),
      );

      expect(clauseTargetNode(defend('Low'))).toEqual(nodes['Near']);
    });

    it('has no target with no raid anywhere', () => {
      seedDecreeWorld([{ content: town('Larsia', 1), steps: 1 }]);

      expect(clauseTargetNode(defend('High'))).toBeUndefined();
    });
  });
});

describe('isClauseSatisfiable', () => {
  const gather = decreeClause({
    type: 'GatherMaterial',
    materialId: wood,
    targetQuantity: 5,
  });
  const grovePlaces = [{ content: grove('Grove', [wood]), steps: 1 }];
  const ruinsPlaces = [
    { content: explore('Forest Ruins', 10), steps: 1 },
    { content: town('Larsia', 1), steps: 1 },
    { name: 'Kingdom', type: 'Kingdom' as const, steps: 1 },
  ];
  const fighting = [
    finish,
    levelUp,
    farm(),
    decreeClause({ type: 'DefendTowns', riskTolerance: 'High' }),
  ];

  it('is false for a disabled clause', () => {
    seedDecreeWorld(grovePlaces);

    expect(isClauseSatisfiable({ ...gather, enabled: false })).toBe(false);
    expect(isClauseSatisfiable(gather)).toBe(true);
  });

  it('gathers until stock reaches the target', () => {
    seedDecreeWorld(grovePlaces, stocked(wood, 4));
    expect(isClauseSatisfiable(gather)).toBe(true);

    seedDecreeWorld(grovePlaces, stocked(wood, 5));
    expect(isClauseSatisfiable(gather)).toBe(false);

    seedDecreeWorld([{ content: grove('Grove', [wood]) }]);
    expect(isClauseSatisfiable(gather)).toBe(false);
  });

  it('farms until the reward reaches the target', () => {
    seedDecreeWorld(ruinsPlaces, stocked(bone, 4));
    expect(isClauseSatisfiable(farm())).toBe(true);

    seedDecreeWorld(ruinsPlaces, stocked(bone, 5));
    expect(isClauseSatisfiable(farm())).toBe(false);
  });

  it('levels the party until the weakest hero hits the level cap', () => {
    const places = [
      { content: explore('Peak', CHARACTER_MAX_LEVEL), steps: 1 },
    ];

    seedDecreeWorld(
      places,
      partyAt(CHARACTER_MAX_LEVEL - 1, CHARACTER_MAX_LEVEL),
    );
    expect(isClauseSatisfiable(levelUp)).toBe(true);

    seedDecreeWorld(places, partyAt(CHARACTER_MAX_LEVEL));
    expect(isClauseSatisfiable(levelUp)).toBe(false);
  });

  it('returns home only while away from it', () => {
    const places = [
      { name: 'Kingdom', type: 'Kingdom' as const },
      { name: 'Field', type: 'ExploreNode' as const },
    ];

    seedDecreeWorld(places, standingAt('Field'));
    expect(isClauseSatisfiable(goHome)).toBe(true);

    seedDecreeWorld(places, standingAt('Kingdom'));
    expect(isClauseSatisfiable(goHome)).toBe(false);
  });

  it('holds back every fighting clause, and only those, while waiting to heal', () => {
    seedDecreeWorld(
      [...ruinsPlaces, ...grovePlaces],
      withEdits(raidOn('Larsia'), hurtAndWaiting),
    );

    fighting.forEach((c) => {
      expect(isClauseSatisfiable(c)).toBe(false);
      expect(isClauseBlockedOnlyByHealth(c)).toBe(true);
    });
    [gather, goHome].forEach((c) => {
      expect(isClauseSatisfiable(c)).toBe(true);
      expect(isClauseBlockedOnlyByHealth(c)).toBe(false);
    });
    expect(isClauseBlockedOnlyByHealth({ ...finish, enabled: false })).toBe(
      false,
    );
  });

  it('waits on energy the same way', () => {
    seedDecreeWorld(ruinsPlaces, (state) => {
      state.world.party = [{ ...buildCharacter({ level: 10 }), ep: 0 }];
      state.world.autoMode.waitForFullEnergyBeforeCombat = true;
    });

    expect(isClauseSatisfiable(finish)).toBe(false);
    expect(isClauseBlockedOnlyByHealth(finish)).toBe(true);
  });

  it('ignores an unhealthy party when not set to wait, and the setting for a healthy party', () => {
    seedDecreeWorld(ruinsPlaces, (state) => {
      state.world.party = [{ ...buildCharacter({ level: 10 }), hp: 0, ep: 0 }];
    });
    expect(isClauseSatisfiable(finish)).toBe(true);
    expect(isClauseBlockedOnlyByHealth(finish)).toBe(false);

    seedDecreeWorld(ruinsPlaces, (state) => {
      state.world.autoMode.waitForFullHealthBeforeCombat = true;
      state.world.autoMode.waitForFullEnergyBeforeCombat = true;
    });
    expect(isClauseSatisfiable(finish)).toBe(true);
  });

  it('is not merely waiting to heal when there is nothing to do anyway', () => {
    seedDecreeWorld(
      [{ content: town('Larsia', 1), steps: 1 }],
      withEdits(hurtAndWaiting, stocked(bone, 5)),
    );

    fighting.forEach((c) => expect(isClauseBlockedOnlyByHealth(c)).toBe(false));
  });

  it('is not merely waiting to heal once the party is at the level cap', () => {
    seedDecreeWorld(
      [{ content: explore('Peak', CHARACTER_MAX_LEVEL), steps: 1 }],
      withEdits(partyAt(CHARACTER_MAX_LEVEL), hurtAndWaiting),
    );

    expect(isClauseBlockedOnlyByHealth(levelUp)).toBe(false);
  });
});

describe('pickTopPriorityClause', () => {
  const gather = decreeClause(
    {
      type: 'GatherMaterial',
      materialId: wood,
      nodeName: 'Grove',
      targetQuantity: 50,
    },
    { id: 'gather' as DecreeClauseId },
  );
  const farmFirst = { ...farm(), id: 'farm' as DecreeClauseId };
  const places = [
    { content: explore('Forest Ruins', 10), steps: 1 },
    { content: grove('Grove', [wood]), steps: 1 },
    { name: 'Kingdom', type: 'Kingdom' as const },
  ];

  it('returns the first satisfiable clause in priority order', () => {
    seedDecreeWorld(places, standingAt('Kingdom'));

    expect(pickTopPriorityClause([goHome, gather])?.id).toBe('gather');
    expect(pickTopPriorityClause([goHome])).toBeUndefined();
  });

  it('keeps a clause waiting to heal ahead of a satisfiable lower one', () => {
    seedDecreeWorld(places, hurtAndWaiting);
    expect(pickTopPriorityClause([farmFirst, gather])?.id).toBe('farm');

    seedDecreeWorld(places, withEdits(hurtAndWaiting, stocked(bone, 5)));
    expect(pickTopPriorityClause([farmFirst, gather])?.id).toBe('gather');
  });
});
