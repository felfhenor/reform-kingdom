import { signal } from '@angular/core';
import { modalCloseAll, modalOpen } from '@helpers/modal-stack';
import { localStorageSignal } from '@helpers/signal';
import type {
  CharacterId,
  GamePlayView,
  KingdomSubview,
  WorldNodeEntry,
} from '@interfaces';

export function isPageVisible(): boolean {
  return !document.hidden;
}

// Ticks once a second, independent of the gameloop (which only advances on
// its own cadence and skips entirely while the tab isn't visible). Purely a
// change-detection nudge - components that display live countdowns (craft
// queues, etc.) read this inside a `computed()` so their derived text
// re-renders every second even when the underlying game state hasn't
// changed since the last real gameloop tick.
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

// The hero the Combat Orders modal is currently open for. Not cleared on
// close, same reasoning as `activeCaravanNode` below - the modal's body
// content is derived from this signal, and clearing it in the same tick
// as closing would collapse the DOM mid-transition.
export const combatOrdersModalCharacterId = signal<CharacterId | undefined>(
  undefined,
);

export function combatOrdersModalOpen(characterId: CharacterId): void {
  combatOrdersModalCharacterId.set(characterId);
  modalOpen('combat-orders');
}

export const isWorldCameraPanned = signal<boolean>(false);

// Incremented to signal a recenter request; the world map component (which
// owns the actual camera state) watches this via an effect and reacts by
// resetting its camera offset - the trigger has to live here rather than a
// direct method call because the recenter button is rendered in the navbar,
// a component with no reference to the map component.
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

// The caravan node the trade modal is currently open for - set from both the
// map node panel's "Open Trade" button and the navbar's glowing trade
// button, so the modal (mounted once in the navbar) can be reached from any
// screen without needing a direct reference to whichever button opened it.
// Not cleared on close - the trade modal's body content is derived from
// this same signal, and clearing it in the same tick as closing would
// collapse the modal's DOM mid-transition (see `ModalComponent`). It's
// simply overwritten the next time a trade is opened.
export const activeCaravanNode = signal<WorldNodeEntry | undefined>(undefined);

export function caravanTradeOpen(entry: WorldNodeEntry): void {
  activeCaravanNode.set(entry);
  modalOpen('caravan-trade');
}

export function closeAllMenus(smart = false) {
  if (smart && showAnySubmenu()) {
    showAnySubmenu.set(false);
    return;
  }

  showAnySubmenu.set(false);
  modalCloseAll();
}
