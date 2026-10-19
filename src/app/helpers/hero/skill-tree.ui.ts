import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import {
  stateSkillTreeConfirm,
  stateSkillTreeReset,
} from '@helpers/hero/skill-tree-state';
import { updateGamestate } from '@helpers/state-game';
import type {
  CharacterId,
  GameState,
  JobContent,
  JobId,
  SkillTreeNodeId,
} from '@interfaces';

async function skillTreeApply(
  action: string,
  mutate: (state: GameState) => JobId | undefined,
): Promise<boolean> {
  let jobId: JobId | undefined;
  await updateGamestate((state) => {
    jobId = mutate(state);
    return state;
  });
  if (!jobId) return false;

  const jobName = getEntry<JobContent>(jobId)?.name ?? 'Unknown';
  analyticsSendDesignEvent(`Hero:SkillTree:${action}`);
  analyticsSendDesignEvent(
    `Hero:SkillTree:${action}:${analyticsSafeSegment(jobName)}`,
  );
  return true;
}

export async function skillTreeConfirm(
  characterId: CharacterId,
  nodeIds: SkillTreeNodeId[],
): Promise<boolean> {
  return skillTreeApply('Confirm', (state) =>
    stateSkillTreeConfirm(state, characterId, nodeIds),
  );
}

export async function skillTreeReset(
  characterId: CharacterId,
): Promise<boolean> {
  return skillTreeApply('Reset', (state) =>
    stateSkillTreeReset(state, characterId),
  );
}
