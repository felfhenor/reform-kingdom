import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import {
  stateSkillTreeConfirm,
  stateSkillTreeReset,
} from '@helpers/hero/skill-tree-state';
import {
  characterSkillTreeAvailableSp,
  characterSkillTreeNodeIds,
  skillTreeNodeIsLearnable,
  skillTreePrune,
} from '@helpers/hero/skill-tree';
import {
  skillTreeJobNodes,
  skillTreeNodeLevel,
  skillTreeNodeShortName,
  skillTreeOptionOath,
} from '@helpers/hero/skill-tree-content';
import { updateGamestate } from '@helpers/state-game';
import type {
  Character,
  CharacterId,
  GameState,
  JobContent,
  JobId,
  Regalia,
  SkillTreeNodeContent,
  SkillTreeNodeId,
  SkillTreeNodeState,
  SkillTreeOathChoice,
} from '@interfaces';
import { isEqual, sortBy } from 'es-toolkit/compat';

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

// Nodes locked out by an oath pick: the other option, and anything that needs it.
function skillTreeExcludedIds(
  nodes: SkillTreeNodeContent[],
  chosen: Set<SkillTreeNodeId>,
): Set<SkillTreeNodeId> {
  const excluded = new Set<SkillTreeNodeId>();
  sortBy(nodes, (node) => skillTreeNodeLevel(nodes, node)).forEach((node) => {
    const oath = skillTreeOptionOath(nodes, node.id);
    const siblingChosen = !!oath?.optionSkillTreeNodeIds.some(
      (id) => id !== node.id && chosen.has(id),
    );
    const parentExcluded = (oath ?? node).requiredSkillTreeNodeIds.some((id) =>
      excluded.has(id),
    );
    if (!chosen.has(node.id) && (siblingChosen || parentExcluded)) {
      excluded.add(node.id);
    }
  });
  return excluded;
}

function skillTreeNodeStateOf(
  node: SkillTreeNodeContent,
  nodes: SkillTreeNodeContent[],
  context: {
    learned: Set<SkillTreeNodeId>;
    chosen: Set<SkillTreeNodeId>;
    excluded: Set<SkillTreeNodeId>;
    freeSp: number;
    level: number;
  },
): SkillTreeNodeState {
  if (context.learned.has(node.id)) return 'learned';
  if (context.chosen.has(node.id)) return 'pending';
  if (context.excluded.has(node.id)) return 'excluded';
  return context.freeSp > 0 &&
    skillTreeNodeIsLearnable(nodes, context.chosen, node, context.level)
    ? 'available'
    : 'locked';
}

// How each node of the current job's tree reads with `staged` added on top of the confirmed tree.
export function characterSkillTreeNodeStates(
  character: Pick<
    Character,
    'jobId' | 'level' | 'jobProgress' | 'skillTreeNodes'
  >,
  staged: SkillTreeNodeId[],
): Map<SkillTreeNodeId, SkillTreeNodeState> {
  const nodes = skillTreeJobNodes(character.jobId);
  const learned = new Set(
    characterSkillTreeNodeIds(character, character.jobId),
  );
  const chosen = new Set([...learned, ...staged]);
  const context = {
    learned,
    chosen,
    excluded: skillTreeExcludedIds(nodes, chosen),
    freeSp:
      characterSkillTreeAvailableSp(character, character.jobId) - staged.length,
    level: character.level,
  };

  return new Map(
    nodes.map((node) => [node.id, skillTreeNodeStateOf(node, nodes, context)]),
  );
}

export function skillTreeOathChoice(
  oath: SkillTreeNodeContent,
  states: Map<SkillTreeNodeId, SkillTreeNodeState>,
): SkillTreeOathChoice | undefined {
  const chosen = oath.optionSkillTreeNodeIds
    .map((id) => getEntry<SkillTreeNodeContent>(id))
    .find((option) => {
      const state = option ? states.get(option.id) : undefined;
      return state === 'learned' || state === 'pending';
    });
  const state = chosen ? states.get(chosen.id) : undefined;
  return chosen && state
    ? { name: skillTreeNodeShortName(chosen), state }
    : undefined;
}

// Unstaging a node also unstages anything staged that depended on it.
export function characterSkillTreeStagedWithout(
  character: Pick<
    Character,
    'jobId' | 'level' | 'jobProgress' | 'skillTreeNodes'
  >,
  staged: SkillTreeNodeId[],
  nodeId: SkillTreeNodeId,
): SkillTreeNodeId[] {
  const learned = characterSkillTreeNodeIds(character, character.jobId);
  return skillTreePrune(
    character.jobId,
    [...learned, ...staged.filter((id) => id !== nodeId)],
    character.level,
  ).filter((id) => !learned.includes(id));
}

function sameTree(a: SkillTreeNodeId[], b: SkillTreeNodeId[]): boolean {
  return isEqual(sortBy(a), sortBy(b));
}

// Equipping swaps in the regalia's tree. It only costs something when the live tree isn't saved in any regalia and the swap drops nodes the freed SP can't simply re-buy, i.e. the regalia has nodes the live tree lacks.
export function regaliaEquipLosesLiveTree(
  regalias: Regalia[],
  character: Pick<Character, 'id' | 'skillTreeNodes'>,
  regalia: Regalia,
): boolean {
  const live = characterSkillTreeNodeIds(character, regalia.jobId);
  if (regalia.skillTreeNodeIds.every((id) => live.includes(id))) return false;

  return !regalias.some(
    (entry) =>
      entry.characterId === character.id &&
      entry.jobId === regalia.jobId &&
      sameTree(entry.skillTreeNodeIds, live),
  );
}
