import { combatCheckIfOver } from '@helpers/combat/combat-end';
import { encounterStartFight } from '@helpers/encounter/encounter';
import { encounterRandomStartFight } from '@helpers/encounter/encounter-random-combat';
import { travelRelocateTo } from '@helpers/hero/travel';
import { waitForGameloopIdle } from '@helpers/savefile/savefile-load';
import {
  gamestateTickEnd,
  gamestateTickStart,
  worldCombatState,
} from '@helpers/state-game';
import { worldNodeVisit } from '@helpers/world-node/world-node-visit';
import {
  worldNodeByName,
  worldNodeEncounter,
  worldNodeEncounterRandom,
} from '@helpers/world-node/world-nodes';

function debugStartNodeFight(nodeName: string): boolean {
  const node = worldNodeByName(nodeName);
  if (!node) {
    console.warn(`Node "${nodeName}" not found.`);
    return false;
  }

  const encounter = worldNodeEncounter(node);
  if (!encounter && !worldNodeEncounterRandom(node)) {
    console.warn(`Node "${nodeName}" has no encounter.`);
    return false;
  }

  travelRelocateTo(node);
  worldNodeVisit(node);
  if (encounter) encounterStartFight(encounter.id, 0, node.nodeName);
  else encounterRandomStartFight(node, 0);
  return true;
}

// Each win goes through the real victory path, which starts the encounter's next fight until none is left.
function debugWinRemainingFights(): void {
  let current = worldCombatState();
  while (current) {
    const combat = structuredClone(current);
    combat.guardians.forEach((guardian) => (guardian.hp = 0));
    combatCheckIfOver(combat);

    const next = worldCombatState();
    if (next === current) return;
    current = next;
  }
}

// Runs as its own tick so every state write lands synchronously, as it would mid-fight.
export async function debugWinCombat(nodeName?: string): Promise<void> {
  await waitForGameloopIdle();

  gamestateTickStart();
  try {
    if (nodeName && !debugStartNodeFight(nodeName)) return;
    if (!worldCombatState()) {
      console.warn('There is no combat to win.');
      return;
    }

    debugWinRemainingFights();
  } finally {
    gamestateTickEnd();
  }
}
