import { computed, signal } from '@angular/core';

export function isPageVisible(): boolean {
  return !document.hidden;
}

export const windowHeight = signal<number>(window.innerHeight);
export const windowWidth = signal<number>(window.innerWidth);

export const showAnySubmenu = signal<boolean>(false);

export const showOptionsMenu = signal<boolean>(false);

export const isShowingAnyMenu = computed(() => showOptionsMenu());

export function closeAllMenus(smart = false) {
  if (smart && showAnySubmenu()) {
    showAnySubmenu.set(false);
    return;
  }

  showAnySubmenu.set(false);
  showOptionsMenu.set(false);
}
