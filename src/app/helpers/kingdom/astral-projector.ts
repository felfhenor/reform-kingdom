import { miscellaneousMessageLog } from '@helpers/combat/combat-log';
import { MAX_ACTIVE_ASTRAL_PROJECTOR_SPELLS } from '@helpers/config';
import { getEntriesByType, getEntry } from '@helpers/content/content';
import { notifySuccess } from '@helpers/engine/notify';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { isCollectibleDiscovered } from '@helpers/item/collectibles';
import { getMaterialQuantity } from '@helpers/item/materials';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type {
  AstralProjectorContent,
  AstralProjectorId,
  GameStateActiveAstralProjectorSpell,
  GameStateDiscoveredAstralProjectorSpells,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

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

// Undefined when there's room, or the only active entry already *is* `id` - a recast is a refresh, not an overwrite.
export function astralProjectorSpellToBeOverwritten(
  id: AstralProjectorId,
): AstralProjectorContent | undefined {
  const active = activeAstralProjectorSpells();
  if (active.length < MAX_ACTIVE_ASTRAL_PROJECTOR_SPELLS) return undefined;

  const oldest = sortBy(active, (spell) => spell.startedAtTick)[0];
  if (!oldest || oldest.astralProjectorId === id) return undefined;

  return getEntry<AstralProjectorContent>(oldest.astralProjectorId);
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
      state.activeAstralProjectorSpells =
        state.activeAstralProjectorSpells.filter(
          (active) => active.astralProjectorId !== spell.astralProjectorId,
        );
      return state;
    });

    if (content) {
      miscellaneousMessageLog(`**${content.name}** has faded.`);
    }
  });
}

// The linked GlobalEffect expires on its own (same duration) - this just keeps our own bookkeeping in sync.
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
