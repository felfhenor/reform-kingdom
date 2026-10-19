import { combatOrderClauseUsesUnknownFamily } from '@helpers/combat/combat-order';
import { characterSkills } from '@helpers/hero/job';
import { characterRecalculateStats } from '@helpers/hero/party';
import {
  characterCurrentRegalia,
  regaliaAppliedCharacter,
} from '@helpers/hero/regalia';
import { characterSkillTreeWithAdditions } from '@helpers/hero/skill-tree';
import { applyMaterialDelta, memoryFluxId } from '@helpers/item/materials';
import type {
  Character,
  CharacterId,
  CombatOrderClause,
  EquipmentSkillContent,
  GameState,
  JobId,
  SkillTreeNodeId,
} from '@interfaces';

// The current regalia is the hero's active build, so it auto-saves every tree change.
function stateSkillTreeWrite(
  state: GameState,
  character: Character,
  nodeIds: SkillTreeNodeId[],
): void {
  character.skillTreeNodes[character.jobId] = nodeIds;
  const regalia = characterCurrentRegalia(state.regalias.entries, character);
  if (regalia) regalia.skillTreeNodeIds = [...nodeIds];

  Object.assign(character, characterRecalculateStats(character));
}

// Returns the hero's job if the additions were valid and applied.
export function stateSkillTreeConfirm(
  state: GameState,
  characterId: CharacterId,
  nodeIds: SkillTreeNodeId[],
): JobId | undefined {
  const character = state.world.party.find((c) => c.id === characterId);
  const tree = character
    ? characterSkillTreeWithAdditions(character, nodeIds)
    : undefined;
  if (!character || !tree) return undefined;

  stateSkillTreeWrite(state, character, tree);
  return character.jobId;
}

function disableUnknownFamilyClauses(
  orders: CombatOrderClause[],
  known: EquipmentSkillContent[],
): void {
  const families = known.map((skill) => skill.family);
  orders.forEach((clause) => {
    if (combatOrderClauseUsesUnknownFamily(clause, families)) {
      clause.enabled = false;
    }
  });
}

// The regalia's orders are judged by its own gear, which may differ from what the hero wears right now.
function stateDisableForgottenOrders(
  state: GameState,
  character: Character,
): void {
  disableUnknownFamilyClauses(
    character.combatOrders[character.jobId] ?? [],
    characterSkills(character),
  );

  const regalia = characterCurrentRegalia(state.regalias.entries, character);
  if (!regalia) return;

  const available = [...state.regalias.vault, ...state.armory];
  disableUnknownFamilyClauses(
    regalia.combatOrders,
    characterSkills(regaliaAppliedCharacter(regalia, character, available)),
  );
}

// Spends 1 Memory Flux to refund every node of the current job's live tree and current regalia, defaults included.
export function stateSkillTreeReset(
  state: GameState,
  characterId: CharacterId,
): JobId | undefined {
  const character = state.world.party.find((c) => c.id === characterId);
  const fluxId = memoryFluxId();
  if (!character || !fluxId) return undefined;
  if ((state.materials[fluxId]?.quantity ?? 0) < 1) return undefined;

  const regalia = characterCurrentRegalia(state.regalias.entries, character);
  const nothingToRefund =
    (character.skillTreeNodes[character.jobId] ?? []).length === 0 &&
    (regalia?.skillTreeNodeIds ?? []).length === 0;
  if (nothingToRefund) return undefined;

  applyMaterialDelta(state, fluxId, -1);
  stateSkillTreeWrite(state, character, []);
  stateDisableForgottenOrders(state, character);
  return character.jobId;
}
