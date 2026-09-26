import { getEntry } from '@helpers/content/content';
import { tasksRecord } from '@helpers/task/task-record';
import type {
  CollectibleId,
  MonsterId,
  TownId,
  TradeskillId,
  TrainerContent,
  TrainerTeachingId,
  WorkerId,
} from '@interfaces';

export function taskEventLevelReached(level: number): Promise<void> {
  return tasksRecord(
    (requirement) =>
      requirement.kind === 'ReachLevel' && level >= requirement.level,
  );
}

export function taskEventTradeskillLevel(
  tradeskillId: TradeskillId,
  level: number,
): Promise<void> {
  return tasksRecord(
    (requirement) =>
      requirement.kind === 'TradeskillLevel' &&
      requirement.tradeskillId === tradeskillId &&
      level >= requirement.level,
  );
}

export function taskEventCollectibleGained(
  collectibleId: CollectibleId,
): Promise<void> {
  return tasksRecord(
    (requirement) =>
      requirement.kind === 'OwnCollectible' &&
      requirement.collectibleId === collectibleId,
  );
}

export function taskEventTeachingLearned(
  teachingId: TrainerTeachingId,
): Promise<void> {
  return tasksRecord(
    (requirement) =>
      requirement.kind === 'LearnTeaching' &&
      !!getEntry<TrainerContent>(
        requirement.trainerId,
      )?.trainerTeachingIds.includes(teachingId),
  );
}

export function taskEventWorkerRescued(workerId: WorkerId): Promise<void> {
  return tasksRecord(
    (requirement) =>
      requirement.kind === 'RescueWorker' && requirement.workerId === workerId,
  );
}

export function taskEventMonsterKilled(
  monsterId: MonsterId,
  totalKills: number,
): Promise<void> {
  return tasksRecord(
    (requirement) =>
      requirement.kind === 'DefeatMonster' &&
      requirement.monsterId === monsterId &&
      totalKills >= requirement.quantity,
  );
}

export function taskEventShrineLevel(
  nodeName: string,
  level: number,
): Promise<void> {
  return tasksRecord(
    (requirement) =>
      requirement.kind === 'ShrineLevel' &&
      requirement.nodeName === nodeName &&
      level >= requirement.level,
  );
}

export function taskEventTownReputationTier(
  townId: TownId,
  tier: number,
): Promise<void> {
  return tasksRecord(
    (requirement) =>
      requirement.kind === 'TownReputationTier' &&
      requirement.townId === townId &&
      tier >= requirement.tier,
  );
}

export function taskEventTownVisited(townId: TownId): Promise<void> {
  return tasksRecord(
    (requirement) =>
      requirement.kind === 'VisitTown' && requirement.townId === townId,
  );
}

export function taskEventEquipmentInfused(): Promise<void> {
  return tasksRecord((requirement) => requirement.kind === 'InfuseEquipment');
}
