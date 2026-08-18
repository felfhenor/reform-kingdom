import { generateEncounterRandomFights } from '@helpers/encounter-random-generate';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { timerTicksElapsed } from '@helpers/timer';
import {
  worldNodeEncounterRandom,
  worldNodesOfType,
} from '@helpers/world-nodes';
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
  return nowTick - state.generatedAtTick >= content.resetTime;
}

function regenerateEncounterRandomNode(
  content: EncounterRandomContent,
  nowTick: number,
): void {
  updateGamestate((state) => {
    state.world.exploreRandom[content.id] = {
      fights: generateEncounterRandomFights(content),
      generatedAtTick: nowTick,
      completedThisCycle: false,
    };
    return state;
  });
}

// Skips a node with active combat so regeneration is deferred, not lost, rather than rewriting a mid-fight's monsters.
export function encounterRandomProcessTick(): void {
  const nowTick = timerTicksElapsed();
  const activeEncounterRandomId = gamestate().world.combat?.encounterRandomId;

  worldNodesOfType('ExploreRandomNode').forEach((entry) => {
    const content = worldNodeEncounterRandom(entry);
    if (!content) return;
    if (content.id === activeEncounterRandomId) return;

    const state = gamestate().world.exploreRandom[content.id];
    if (!isDueForRegeneration(content, state, nowTick)) return;

    regenerateEncounterRandomNode(content, nowTick);
  });
}
