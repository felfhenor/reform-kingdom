import { beforeEach, describe, expect, it } from 'vitest';

import { ensureTask } from '@helpers/content/ensure-task';
import { ensureTrainer } from '@helpers/content/ensure-trainer';
import { tasksState } from '@helpers/state-game';
import {
  taskEventLevelReached,
  taskEventMonsterKilled,
  taskEventShrineLevel,
  taskEventTeachingLearned,
  taskEventTownReputationTier,
  taskEventTradeskillLevel,
} from '@helpers/task/task-events';
import type {
  IsContentItem,
  MonsterId,
  TaskId,
  TaskRequirement,
  TownId,
  TradeskillId,
  TrainerId,
  TrainerTeachingId,
} from '@interfaces';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';

const GOBLIN = 'monster-goblin' as MonsterId;
const BLACKSMITHING = 'tradeskill-blacksmithing' as TradeskillId;
const LARSIA = 'town-larsia' as TownId;
const REYN = 'trainer-reyn' as TrainerId;
const REYN_TEACHING = 'teaching-health' as TrainerTeachingId;

const requirements: Record<string, TaskRequirement> = {
  level: { kind: 'ReachLevel', level: 5 },
  tradeskill: {
    kind: 'TradeskillLevel',
    tradeskillId: BLACKSMITHING,
    level: 5,
  },
  goblins: { kind: 'DefeatMonster', monsterId: GOBLIN, quantity: 25 },
  shrine: { kind: 'ShrineLevel', nodeName: 'Shrine of Izchak', level: 1 },
  reputation: { kind: 'TownReputationTier', townId: LARSIA, tier: 2 },
  teaching: { kind: 'LearnTeaching', trainerId: REYN },
};

function isComplete(key: string): boolean {
  return !!tasksState()[key as TaskId]?.completedAt;
}

beforeEach(() => {
  const content: IsContentItem[] = [
    ...Object.entries(requirements).map(([id, requirement], index) =>
      ensureTask({ id: id as TaskId, order: index, requirement }),
    ),
    ensureTrainer({ id: REYN, trainerTeachingIds: [REYN_TEACHING] }),
  ];
  seedContent(content);
  seedGamestate();
});

describe('task events', () => {
  it('only latches ReachLevel once the reported level meets it', () => {
    void inTick(() => taskEventLevelReached(4));
    expect(isComplete('level')).toBe(false);

    void inTick(() => taskEventLevelReached(5));
    expect(isComplete('level')).toBe(true);
  });

  it('matches TradeskillLevel on both the tradeskill and the level', () => {
    void inTick(() =>
      taskEventTradeskillLevel('tradeskill-tailoring' as TradeskillId, 9),
    );
    void inTick(() => taskEventTradeskillLevel(BLACKSMITHING, 4));
    expect(isComplete('tradeskill')).toBe(false);

    void inTick(() => taskEventTradeskillLevel(BLACKSMITHING, 5));
    expect(isComplete('tradeskill')).toBe(true);
  });

  it('compares the lifetime kill total for DefeatMonster', () => {
    void inTick(() => taskEventMonsterKilled(GOBLIN, 24));
    expect(isComplete('goblins')).toBe(false);

    void inTick(() => taskEventMonsterKilled(GOBLIN, 25));
    expect(isComplete('goblins')).toBe(true);
  });

  it('matches ShrineLevel on the shrine node and level', () => {
    void inTick(() => taskEventShrineLevel('Shrine of the Founder', 1));
    expect(isComplete('shrine')).toBe(false);

    void inTick(() => taskEventShrineLevel('Shrine of Izchak', 1));
    expect(isComplete('shrine')).toBe(true);
  });

  it('matches TownReputationTier on the town and tier', () => {
    void inTick(() => taskEventTownReputationTier(LARSIA, 1));
    expect(isComplete('reputation')).toBe(false);

    void inTick(() => taskEventTownReputationTier(LARSIA, 2));
    expect(isComplete('reputation')).toBe(true);
  });

  it('credits LearnTeaching only for a teaching that trainer offers', () => {
    void inTick(() =>
      taskEventTeachingLearned('teaching-other' as TrainerTeachingId),
    );
    expect(isComplete('teaching')).toBe(false);

    void inTick(() => taskEventTeachingLearned(REYN_TEACHING));
    expect(isComplete('teaching')).toBe(true);
  });
});
