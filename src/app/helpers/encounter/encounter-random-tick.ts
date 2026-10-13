import { encounterRandomResetTime } from '@helpers/encounter/encounter-random';
import { generateEncounterRandomFights } from '@helpers/encounter/encounter-random-generate';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { jobAbilityValue } from '@helpers/hero/job-ability';
import {
  updateGamestate,
  worldCombatState,
  worldExploreRandomState,
} from '@helpers/state-game';
import {
  worldNodeEncounterRandom,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type {
  EncounterRandomContent,
  EncounterRandomNodeState,
} from '@interfaces';

function isDueForRegeneration(
  content: EncounterRandomContent,
  state: EncounterRandomNodeState | undefined,
  nowTick: number,
): boolean {
  if (!state) return true;
  return (
    nowTick - state.generatedAtTick >= encounterRandomResetTime(content, state)
  );
}

function regenerateEncounterRandomNode(
  content: EncounterRandomContent,
  nowTick: number,
): void {
  // EncounterResetReduction only counts if present right now, at the reset - it fixes the length of the cycle that starts here.
  const resetTime = Math.round(
    content.resetTime * (1 - jobAbilityValue('EncounterResetReduction')),
  );

  updateGamestate((state) => {
    state.world.exploreRandom[content.id] = {
      fights: generateEncounterRandomFights(content),
      generatedAtTick: nowTick,
      completedThisCycle: false,
      resetTime,
    };
    return state;
  });
}

// Skips a node with active combat so regeneration is deferred, not lost, rather than rewriting a mid-fight's monsters.
export function encounterRandomProcessTick(): void {
  const nowTick = timerTicksElapsed();
  const activeEncounterRandomId = worldCombatState()?.encounterRandomId;

  worldNodesOfType('ExploreRandomNode').forEach((entry) => {
    const content = worldNodeEncounterRandom(entry);
    if (!content) return;
    if (content.id === activeEncounterRandomId) return;

    const state = worldExploreRandomState()[content.id];
    if (!isDueForRegeneration(content, state, nowTick)) return;

    regenerateEncounterRandomNode(content, nowTick);
  });
}
