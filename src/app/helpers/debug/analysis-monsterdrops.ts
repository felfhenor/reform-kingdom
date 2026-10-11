// Omitted `chance` defaults to 0, so this also catches drops that forgot to set one.

import { getEntriesByType, getEntry } from '@helpers/content/content';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  DroppedReward,
  MonsterContent,
} from '@interfaces';

function dropContentId(drop: DroppedReward): string {
  switch (drop.kind) {
    case 'Item':
      return drop.itemId;
    case 'Equipment':
      return drop.equipmentId;
    case 'Collectible':
      return drop.collectibleId;
    case 'Recipe':
      return drop.recipeId;
    case 'Worker':
      return drop.workerId;
  }
}

function dropName(drop: DroppedReward): string {
  const id = dropContentId(drop);
  return getEntry(id)?.name ?? id;
}

function checkMonster(monster: MonsterContent): AnalysisCheck {
  const neverDrops = monster.drops.filter((drop) => drop.chance <= 0);

  return {
    id: `monsterdrops:${monster.id}`,
    label: monster.name,
    status: neverDrops.length === 0 ? 'pass' : 'fail',
    message:
      neverDrops.length === 0
        ? `${monster.name}: every drop has a non-zero chance.`
        : `${monster.name}: 0% drop chance on ${neverDrops.map(dropName).join(', ')}.`,
  };
}

export function runMonsterDropsAnalysis(): AnalysisRunResult {
  const monsters = getEntriesByType<MonsterContent>('monster');
  const checks = monsters.map(checkMonster);
  const failures = checks.filter((c) => c.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? `Every monster drop (${monsters.length} monsters checked) has a non-zero chance.`
        : `${failures} of ${monsters.length} monster(s) have a drop with a 0% chance.`,
  };
}
