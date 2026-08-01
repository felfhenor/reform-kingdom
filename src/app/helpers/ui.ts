import { computed, signal } from '@angular/core';
import type { GamePlayView, KingdomSubview } from '@interfaces';

export function isPageVisible(): boolean {
  return !document.hidden;
}

export const windowHeight = signal<number>(window.innerHeight);
export const windowWidth = signal<number>(window.innerWidth);

export const showAnySubmenu = signal<boolean>(false);

export const showOptionsMenu = signal<boolean>(false);

export const gamePlayView = signal<GamePlayView>('world');

export function setGamePlayView(view: GamePlayView): void {
  gamePlayView.set(view);
}

export const kingdomSubview = signal<KingdomSubview | undefined>(undefined);

export function kingdomSubviewShow(subview: KingdomSubview): void {
  kingdomSubview.set(subview);
}

export function kingdomSubviewClear(): void {
  kingdomSubview.set(undefined);
}

export const isShowingAnyMenu = computed(() => showOptionsMenu());

export function closeAllMenus(smart = false) {
  if (smart && showAnySubmenu()) {
    showAnySubmenu.set(false);
    return;
  }

  showAnySubmenu.set(false);
  showOptionsMenu.set(false);
}
