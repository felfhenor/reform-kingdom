import { miscellaneousMessageLog } from '@helpers/combat-log';
import { isCollectibleDiscovered } from '@helpers/collectibles';
import { getEntriesByType, getEntry } from '@helpers/content';
import {
  applyGlobalEffectAdd,
  applyGlobalEffectRemove,
} from '@helpers/global-effects';
import { applyMaterialDelta, getMaterialQuantity, isMaterialDiscovered } from '@helpers/materials';
import { notifySuccess } from '@helpers/notify';
import { isResearchCompleted } from '@helpers/research/research';
import { researchAstralSpellDurationIncreasePercent } from '@helpers/research/research-effects';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { timerTicksElapsed } from '@helpers/timer';
import type {
  AstralProjectorCollectibleEntry,
  AstralProjectorContent,
  AstralProjectorId,
  AstralProjectorMaterialEntry,
  CollectibleContent,
  GameStateActiveAstralProjectorSpell,
  GameStateDiscoveredAstralProjectorSpells,
  ItemContent,
  ResearchContent,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

// The two Arcana-tab research nodes that raise the cap - see the "Node
// roster" section of the research tree plan. Referenced by name (resolved
// to a real id via getEntry, same as goldCoinId/researchPointItemId) since
// research content ids are build-time-generated UUIDs, not stable strings.
// Base cap is 1; each completed node raises it by 1, to a max of 3.
const ASTRAL_CAP_RESEARCH_NAMES = ['Astral Reach I', 'Astral Reach II'];

// The Arcana tab's Amplify I/II nodes stack a % increase, applied live to
// AstralProjectorContent.duration - same "derive don't mutate" approach as
// the cap above, so a balance patch to the effect applies immediately.
function astralProjectorEffectiveDuration(content: AstralProjectorContent): number {
  const percent = researchAstralSpellDurationIncreasePercent();
  return Math.round(content.duration * (1 + percent / 100));
}

export function astralProjectorMaxActiveSpells(): number {
  const completedCount = ASTRAL_CAP_RESEARCH_NAMES.filter((name) => {
    const research = getEntry<ResearchContent>(name);
    return research && isResearchCompleted(research.id);
  }).length;

  return 1 + completedCount;
}

export function astralProjectorEntries(): AstralProjectorContent[] {
  return getEntriesByType<AstralProjectorContent>('astralprojector');
}

// Vacuously true with no required collectibles - intentional, for a future materials-only spell.
export function isAstralProjectorCollectiblesMet(
  content: AstralProjectorContent,
): boolean {
  return content.requiredCollectibles.every((requirement) =>
    isCollectibleDiscovered(requirement.collectibleId),
  );
}

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

export function astralProjectorCollectibleEntries(
  content: AstralProjectorContent,
): AstralProjectorCollectibleEntry[] {
  return content.requiredCollectibles.map((requirement) => ({
    content: getEntry<CollectibleContent>(requirement.collectibleId),
  }));
}

export function isAstralProjectorCastable(
  content: AstralProjectorContent,
): boolean {
  if (!isAstralProjectorCollectiblesMet(content)) return false;

  return content.requiredMaterials.every(
    (requirement) =>
      getMaterialQuantity(requirement.itemId) >= requirement.quantity,
  );
}

export function activeAstralProjectorSpells(): GameStateActiveAstralProjectorSpell[] {
  return gamestate().activeAstralProjectorSpells;
}

export function isAstralProjectorSpellActive(id: AstralProjectorId): boolean {
  return activeAstralProjectorSpells().some(
    (spell) => spell.astralProjectorId === id,
  );
}

// Undefined when there's room, or the only active entry already *is* `id` - a recast is a refresh, not an overwrite.
export function astralProjectorSpellToBeOverwritten(
  id: AstralProjectorId,
): AstralProjectorContent | undefined {
  const active = activeAstralProjectorSpells();
  if (active.length < astralProjectorMaxActiveSpells()) return undefined;

  const oldest = sortBy(active, (spell) => spell.startedAtTick)[0];
  if (!oldest || oldest.astralProjectorId === id) return undefined;

  return getEntry<AstralProjectorContent>(oldest.astralProjectorId);
}

// One `updateGamestate` commit, not chained calls, to avoid `bar-global-effect` seeing a momentary gap.
// The effect is unconditionally removed then re-added so a same-spell recast doesn't duplicate it.
export function astralProjectorCast(id: AstralProjectorId): void {
  const content = getEntry<AstralProjectorContent>(id);
  if (!content || !isAstralProjectorCastable(content)) return;

  const evicted = astralProjectorSpellToBeOverwritten(id);
  const currentTick = timerTicksElapsed();
  const duration = astralProjectorEffectiveDuration(content);

  updateGamestate((state) => {
    content.requiredMaterials.forEach((requirement) => {
      applyMaterialDelta(state, requirement.itemId, -requirement.quantity);
    });

    if (evicted) {
      applyGlobalEffectRemove(state, evicted.globalEffectId);
      state.activeAstralProjectorSpells = state.activeAstralProjectorSpells.filter(
        (spell) => spell.astralProjectorId !== evicted.id,
      );
    }

    applyGlobalEffectRemove(state, content.globalEffectId);
    applyGlobalEffectAdd(
      state,
      content.globalEffectId,
      duration,
      currentTick,
    );

    const existing = state.activeAstralProjectorSpells.find(
      (spell) => spell.astralProjectorId === id,
    );
    const expiresAtTick = currentTick + duration;

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

function astralProjectorProcessUnlocks(): void {
  const discovered = gamestate().discoveredAstralProjectorSpells;

  astralProjectorEntries().forEach((content) => {
    if (discovered[content.id]) return;
    if (!isAstralProjectorCollectiblesMet(content)) return;

    updateGamestate((state) => {
      state.discoveredAstralProjectorSpells[content.id] = {
        foundAt: Date.now(),
      };
      return state;
    });

    notifySuccess(`New Astral Projector spell unlocked: ${content.name}`);
    miscellaneousMessageLog(
      `A new Astral Projector spell has been unlocked: **${content.name}**.`,
    );
  });
}

function astralProjectorProcessExpiry(): void {
  const currentTick = timerTicksElapsed();
  const expired = activeAstralProjectorSpells().filter(
    (spell) => spell.expiresAtTick <= currentTick,
  );

  expired.forEach((spell) => {
    const content = getEntry<AstralProjectorContent>(spell.astralProjectorId);

    updateGamestate((state) => {
      state.activeAstralProjectorSpells = state.activeAstralProjectorSpells.filter(
        (active) => active.astralProjectorId !== spell.astralProjectorId,
      );
      return state;
    });

    if (content) {
      miscellaneousMessageLog(`**${content.name}** has faded.`);
    }
  });
}

// The linked GlobalEffect expires on its own via globalEffectsProcessTick (same duration) - this just keeps our own bookkeeping in sync.
export function astralProjectorProcessTick(): void {
  astralProjectorProcessUnlocks();
  astralProjectorProcessExpiry();
}

export function pruneInvalidDiscoveredAstralProjectorSpells(
  discovered: GameStateDiscoveredAstralProjectorSpells,
): GameStateDiscoveredAstralProjectorSpells {
  const pruned: GameStateDiscoveredAstralProjectorSpells = {};

  (Object.keys(discovered) as AstralProjectorId[]).forEach((id) => {
    if (getEntry<AstralProjectorContent>(id)) {
      pruned[id] = discovered[id];
    }
  });

  return pruned;
}

export function pruneInvalidActiveAstralProjectorSpells(
  active: GameStateActiveAstralProjectorSpell[],
): GameStateActiveAstralProjectorSpell[] {
  return active.filter((spell) =>
    Boolean(getEntry<AstralProjectorContent>(spell.astralProjectorId)),
  );
}
