import { signal } from '@angular/core';
import type { ModalId } from '@interfaces';

// Single source of truth for which modals are open, in open order. Closing
// always affects the topmost entry unless a specific id is given, so
// callers never have to hand-roll a priority order across separate
// visibility signals.
const modalStack = signal<ModalId[]>([]);

export function modalOpen(id: ModalId): void {
  modalStack.update((stack) =>
    stack.includes(id) ? stack : [...stack, id],
  );
}

export function modalClose(id: ModalId): void {
  modalStack.update((stack) => stack.filter((openId) => openId !== id));
}

export function modalCloseTop(): void {
  modalStack.update((stack) => stack.slice(0, -1));
}

export function modalCloseAll(): void {
  modalStack.set([]);
}

export function modalIsOpen(id: ModalId): boolean {
  return modalStack().includes(id);
}

export function modalIsTopmost(id: ModalId): boolean {
  const stack = modalStack();
  return stack.length > 0 && stack[stack.length - 1] === id;
}

export function modalHasAnyOpen(): boolean {
  return modalStack().length > 0;
}
