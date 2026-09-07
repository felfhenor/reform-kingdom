import { miscellaneousMessageLog } from '@helpers/combat/combat-log';
import { getEntry } from '@helpers/content/content';
import { timerTicksElapsed } from '@helpers/engine/timer';
import {
  applyGlobalEffectAdd,
  applyGlobalEffectRemove,
} from '@helpers/hero/global-effect-state';
import {
  applyMaterialDelta,
  getMaterialQuantity,
  isMaterialDiscovered,
} from '@helpers/item/materials';
import {
  astralProjectorEntries,
  astralProjectorSpellToBeOverwritten,
  isAstralProjectorCastable,
  isAstralProjectorCollectiblesMet,
} from '@helpers/kingdom/astral-projector';
import { updateGamestate } from '@helpers/state-game';
import type {
  AstralProjectorContent,
  AstralProjectorId,
  AstralProjectorMaterialEntry,
  ItemContent,
} from '@interfaces';

export function unlockedAstralProjectorEntries(): AstralProjectorContent[] {
  return astralProjectorEntries().filter(isAstralProjectorCollectiblesMet);
}

export function astralProjectorMaterialEntries(
  content: AstralProjectorContent,
): AstralProjectorMaterialEntry[] {
  return content.requiredMaterials.map((requirement) => ({
    content: getEntry<ItemContent>(requirement.itemId),
    quantity: requirement.quantity,
    owned: getMaterialQuantity(requirement.itemId),
    discovered: isMaterialDiscovered(requirement.itemId),
  }));
}

// The effect is unconditionally removed then re-added so a same-spell recast doesn't duplicate it.
export function astralProjectorCast(id: AstralProjectorId): void {
  const content = getEntry<AstralProjectorContent>(id);
  if (!content || !isAstralProjectorCastable(content)) return;

  const evicted = astralProjectorSpellToBeOverwritten(id);
  const currentTick = timerTicksElapsed();

  updateGamestate((state) => {
    content.requiredMaterials.forEach((requirement) => {
      applyMaterialDelta(state, requirement.itemId, -requirement.quantity);
    });

    if (evicted) {
      applyGlobalEffectRemove(state, evicted.globalEffectId);
      state.activeAstralProjectorSpells =
        state.activeAstralProjectorSpells.filter(
          (spell) => spell.astralProjectorId !== evicted.id,
        );
    }

    applyGlobalEffectRemove(state, content.globalEffectId);
    applyGlobalEffectAdd(
      state,
      content.globalEffectId,
      content.duration,
      currentTick,
    );

    const existing = state.activeAstralProjectorSpells.find(
      (spell) => spell.astralProjectorId === id,
    );
    const expiresAtTick = currentTick + content.duration;

    if (existing) {
      existing.expiresAtTick = expiresAtTick;
    } else {
      state.activeAstralProjectorSpells.push({
        astralProjectorId: id,
        startedAtTick: currentTick,
        expiresAtTick,
      });
    }

    return state;
  });

  if (evicted) {
    miscellaneousMessageLog(
      `**${evicted.name}** has faded, overwritten by **${content.name}**.`,
    );
  }

  miscellaneousMessageLog(`**${content.name}** has been cast.`);
}
