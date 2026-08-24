import {
  modalClose,
  modalCloseAll,
  modalCloseTop,
  modalHasAnyOpen,
  modalIsOpen,
  modalIsTopmost,
  modalOpen,
} from '@helpers/engine/modal-stack';
import { beforeEach, describe, expect, it } from 'vitest';

beforeEach(() => {
  modalCloseAll();
});

describe('modalOpen', () => {
  it('adds a modal to the stack', () => {
    modalOpen('settings');
    expect(modalIsOpen('settings')).toBe(true);
  });

  it('does not duplicate an already-open modal', () => {
    modalOpen('settings');
    modalOpen('settings');
    modalOpen('pause-menu');
    modalClose('pause-menu');
    expect(modalIsOpen('settings')).toBe(true);
  });
});

describe('modalClose', () => {
  it('removes a specific modal regardless of stack position', () => {
    modalOpen('settings');
    modalOpen('pause-menu');
    modalClose('settings');
    expect(modalIsOpen('settings')).toBe(false);
    expect(modalIsOpen('pause-menu')).toBe(true);
  });
});

describe('modalCloseTop', () => {
  it('removes only the most recently opened modal', () => {
    modalOpen('settings');
    modalOpen('pause-menu');
    modalCloseTop();
    expect(modalIsOpen('pause-menu')).toBe(false);
    expect(modalIsOpen('settings')).toBe(true);
  });

  it('does nothing when the stack is empty', () => {
    modalCloseTop();
    expect(modalHasAnyOpen()).toBe(false);
  });
});

describe('modalIsTopmost', () => {
  it('is true only for the last-opened modal', () => {
    modalOpen('settings');
    modalOpen('pause-menu');
    expect(modalIsTopmost('pause-menu')).toBe(true);
    expect(modalIsTopmost('settings')).toBe(false);
  });
});

describe('modalHasAnyOpen', () => {
  it('reflects whether the stack is empty', () => {
    expect(modalHasAnyOpen()).toBe(false);
    modalOpen('changelog');
    expect(modalHasAnyOpen()).toBe(true);
  });
});

describe('modalCloseAll', () => {
  it('empties the stack', () => {
    modalOpen('settings');
    modalOpen('pause-menu');
    modalCloseAll();
    expect(modalHasAnyOpen()).toBe(false);
  });
});
