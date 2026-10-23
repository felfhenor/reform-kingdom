import { signal } from '@angular/core';
import { caravanMarkVisited } from '@helpers/caravan/caravan';
import {
  modalCloseAll,
  modalHasAnyOpen,
  modalOpen,
} from '@helpers/engine/modal-stack';
import { localStorageSignal } from '@helpers/engine/signal';
import { townMarkVisited } from '@helpers/town/town-visit';
import { trainerMarkDiscovered } from '@helpers/trainer/trainer';
import {
  worldNodeCaravan,
  worldNodeTown,
  worldNodeTrainer,
} from '@helpers/world-node/world-nodes';
import type {
  CameraPosition,
  CharacterId,
  GamePlayView,
  HeroesSubview,
  KingdomSubview,
  Tradeskill,
  WorldCameraRequest,
  WorldNodeEntry,
} from '@interfaces';

// Change-detection nudge ticking once a second independent of the gameloop, so live countdowns re-render even without a gameloop tick.
export const uiClockTick = signal<number>(0);
setInterval(() => uiClockTick.update((tick) => tick + 1), 1000);

export const windowHeight = signal<number>(window.innerHeight);
export const windowWidth = signal<number>(window.innerWidth);

export const showAnySubmenu = signal<boolean>(false);

export const gamePlayView = localStorageSignal<GamePlayView>(
  'gamePlayView',
  'world',
);

export function setGamePlayView(view: GamePlayView): void {
  gamePlayView.set(view);
}

export const kingdomSubview = localStorageSignal<KingdomSubview | string>(
  'kingdomSubview',
  '',
);

export function kingdomSubviewShow(subview: KingdomSubview): void {
  kingdomSubview.set(subview);
}

export function kingdomSubviewClear(): void {
  kingdomSubview.set('');
}

const TRADESKILL_SUBVIEWS: Record<Tradeskill, KingdomSubview> = {
  Artificing: 'tradeskill-artificing',
  Blacksmithing: 'tradeskill-blacksmithing',
  Jewelcrafting: 'tradeskill-jewelcrafting',
  Tailoring: 'tradeskill-tailoring',
  Woodworking: 'tradeskill-woodworking',
};

export function kingdomSubviewForTradeskill(
  tradeskill: Tradeskill,
): KingdomSubview {
  return TRADESKILL_SUBVIEWS[tradeskill];
}

// Not cleared on close - clearing it would collapse the modal's DOM mid-transition.
export const combatOrdersModalCharacterId = signal<CharacterId | undefined>(
  undefined,
);

export function combatOrdersModalOpen(characterId: CharacterId): void {
  combatOrdersModalCharacterId.set(characterId);
  modalOpen('combat-orders');
}

// Not cleared on close - clearing it would collapse the modal's DOM mid-transition.
export const heroTeachingsModalCharacterId = signal<CharacterId | undefined>(
  undefined,
);

export function heroTeachingsModalOpen(characterId: CharacterId): void {
  heroTeachingsModalCharacterId.set(characterId);
  modalOpen('hero-teachings');
}

export const heroesSelectedCharacterId = signal<CharacterId | undefined>(
  undefined,
);

export function heroesSelectCharacter(characterId: CharacterId): void {
  heroesSelectedCharacterId.set(characterId);
}

export const heroesSubview = signal<HeroesSubview>('');

export function heroesSubviewClear(): void {
  heroesSubview.set('');
}

export function regaliaPageOpen(characterId: CharacterId): void {
  heroesSelectCharacter(characterId);
  heroesSubview.set('regalia');
}

export function skillTreePageOpen(characterId: CharacterId): void {
  heroesSelectCharacter(characterId);
  heroesSubview.set('skilltree');
}

// Set by a page holding unconfirmed work; navigating away asks it first, and it calls `proceed` if the player agrees.
export const navigationLeaveGuard = signal<
  ((proceed: () => void) => void) | undefined
>(undefined);

export function navigationGuarded(proceed: () => void): void {
  const guard = navigationLeaveGuard();
  if (guard) {
    guard(proceed);
    return;
  }

  proceed();
}

// Not cleared on close - clearing it would collapse the modal's DOM mid-transition.
export const heroBurstSkillsModalCharacterId = signal<CharacterId | undefined>(
  undefined,
);

export function heroBurstSkillsModalOpen(characterId: CharacterId): void {
  heroBurstSkillsModalCharacterId.set(characterId);
  modalOpen('hero-burst-skills');
}

export const isWorldCameraPanned = signal<boolean>(false);

// False while the world view is loading or switching maps.
export const worldMapReady = signal<boolean>(false);

// Bridges callers with no reference to the map component; a fresh object per request so repeats still fire.
export const worldCameraRequest = signal<WorldCameraRequest | undefined>(
  undefined,
);

export function worldCameraRecenter(): void {
  worldCameraRequest.set({});
}

export function worldCameraFocus(target: CameraPosition): void {
  worldCameraRequest.set({ target });
}

export const selectedMapNode = signal<WorldNodeEntry | undefined>(undefined);

export function mapNodeSelect(entry: WorldNodeEntry): void {
  selectedMapNode.set(entry);
}

export function mapNodeDeselect(): void {
  selectedMapNode.set(undefined);
}

// Surfaces whatever the party walked into on arrival, but only if nothing else already occupies the screen.
export function mapNodeAutoShowOnArrival(entry: WorldNodeEntry): void {
  if (selectedMapNode() || modalHasAnyOpen()) return;
  selectedMapNode.set(entry);
}

// Set from either trade-opening button so the modal (mounted once in the navbar) needs no direct reference to the caller.
// Not cleared on close - would collapse the modal's DOM mid-transition; overwritten next open instead.
export const activeCaravanNode = signal<WorldNodeEntry | undefined>(undefined);

export function caravanTradeOpen(entry: WorldNodeEntry): void {
  const caravan = worldNodeCaravan(entry);
  if (caravan) caravanMarkVisited(caravan.id);

  activeCaravanNode.set(entry);
  modalOpen('caravan-trade');
}

// Not cleared on close - would collapse the modal's DOM mid-transition; overwritten next open instead.
export const activeTrainerNode = signal<WorldNodeEntry | undefined>(undefined);

export function trainerVisitOpen(entry: WorldNodeEntry): void {
  const trainer = worldNodeTrainer(entry);
  if (trainer) trainerMarkDiscovered(trainer.id);

  activeTrainerNode.set(entry);
  modalOpen('trainer-visit');
}

// Not cleared on close - would collapse the modal's DOM mid-transition; overwritten next open instead.
export const activeExchangeNode = signal<WorldNodeEntry | undefined>(undefined);

export function exchangeNodeOpen(entry: WorldNodeEntry): void {
  activeExchangeNode.set(entry);
  modalOpen('exchange-node');
}

// Not cleared on close - would collapse the modal's DOM mid-transition; overwritten next open instead.
export const activeOutpostTeleportNode = signal<WorldNodeEntry | undefined>(
  undefined,
);

export function outpostTeleportOpen(entry: WorldNodeEntry): void {
  activeOutpostTeleportNode.set(entry);
  modalOpen('outpost-teleport');
}

// Persisted (not just in-memory) so a page reload while on the Town view can restore it.
export const activeTownNode = localStorageSignal<WorldNodeEntry | undefined>(
  'activeTownNode',
  undefined,
);

export function townOpen(entry: WorldNodeEntry): void {
  const town = worldNodeTown(entry);
  if (town) townMarkVisited(town.id);

  activeTownNode.set(entry);
  setGamePlayView('town');
}

// Global across all tradeskills, not per-tradeskill - it's a UI display preference, not a per-building setting.
export const craftingHideUncraftable = localStorageSignal<boolean>(
  'craftingHideUncraftable',
  false,
);

export function craftingHideUncraftableToggle(): void {
  craftingHideUncraftable.update((hide) => !hide);
}

export function closeAllMenus(smart = false) {
  if (smart && showAnySubmenu()) {
    showAnySubmenu.set(false);
    return;
  }

  showAnySubmenu.set(false);
  modalCloseAll();
}
