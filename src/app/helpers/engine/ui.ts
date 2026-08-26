import { signal } from '@angular/core';
import {
  modalCloseAll,
  modalHasAnyOpen,
  modalOpen,
} from '@helpers/engine/modal-stack';
import { localStorageSignal } from '@helpers/engine/signal';
import type {
  CharacterId,
  GamePlayView,
  KingdomSubview,
  Tradeskill,
  WorldNodeEntry,
} from '@interfaces';
import { caravanMarkVisited } from '../caravan/caravan';
import { worldNodeCaravan } from '../world-node/world-nodes';

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

export const kingdomSubview = localStorageSignal<KingdomSubview | undefined>(
  'kingdomSubview',
  undefined,
);

export function kingdomSubviewShow(subview: KingdomSubview): void {
  kingdomSubview.set(subview);
}

export function kingdomSubviewClear(): void {
  kingdomSubview.set(undefined);
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

// Not cleared on close - clearing it would collapse the modal's DOM mid-transition (see `activeCaravanNode`).
export const combatOrdersModalCharacterId = signal<CharacterId | undefined>(
  undefined,
);

export function combatOrdersModalOpen(characterId: CharacterId): void {
  combatOrdersModalCharacterId.set(characterId);
  modalOpen('combat-orders');
}

export const isWorldCameraPanned = signal<boolean>(false);

// Incremented to signal a recenter request; the navbar's button has no direct reference to the map component, so this bridges them.
export const worldCameraRecenterRequest = signal<number>(0);

export function worldCameraRecenter(): void {
  worldCameraRecenterRequest.update((count) => count + 1);
}

export const selectedMapNode = signal<WorldNodeEntry | undefined>(undefined);

export function mapNodeSelect(entry: WorldNodeEntry): void {
  selectedMapNode.set(entry);
}

export function mapNodeDeselect(): void {
  selectedMapNode.set(undefined);
}

// Surfaces whatever the party walked into on arrival, but only if nothing else already occupies the screen (see `travelArriveAtNode`).
export function mapNodeAutoShowOnArrival(entry: WorldNodeEntry): void {
  if (selectedMapNode() || modalHasAnyOpen()) return;
  selectedMapNode.set(entry);
}

// Set from either trade-opening button so the modal (mounted once in the navbar) needs no direct reference to the caller.
// Not cleared on close - would collapse the modal's DOM mid-transition (see `ModalComponent`); overwritten next open instead.
export const activeCaravanNode = signal<WorldNodeEntry | undefined>(undefined);

export function caravanTradeOpen(entry: WorldNodeEntry): void {
  const caravan = worldNodeCaravan(entry);
  if (caravan) caravanMarkVisited(caravan.id);

  activeCaravanNode.set(entry);
  modalOpen('caravan-trade');
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
