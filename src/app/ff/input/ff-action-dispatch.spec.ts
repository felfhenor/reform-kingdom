import {
  ffActionDispatch,
  ffActivePrompts,
} from '@ff/input/ff-action-dispatch';
import type { FFActionRegistration } from '@ff/interfaces/ff-input';
import { describe, expect, it, vi } from 'vitest';

function registration(
  overrides: Partial<FFActionRegistration>,
): FFActionRegistration {
  return {
    action: 'back',
    handler: vi.fn(),
    priority: 0,
    order: 0,
    ...overrides,
  };
}

const alwaysActive = () => true;

describe('ffActionDispatch', () => {
  it('runs the highest priority handler first and stops there', () => {
    const low = registration({ priority: 0, handler: vi.fn() });
    const high = registration({ priority: 10, handler: vi.fn() });
    expect(ffActionDispatch([low, high], 'back', alwaysActive)).toBe(high);
    expect(high.handler).toHaveBeenCalled();
    expect(low.handler).not.toHaveBeenCalled();
  });

  it('prefers the newest registration within a priority', () => {
    const older = registration({ order: 1, handler: vi.fn() });
    const newer = registration({ order: 2, handler: vi.fn() });
    ffActionDispatch([older, newer], 'back', alwaysActive);
    expect(newer.handler).toHaveBeenCalled();
    expect(older.handler).not.toHaveBeenCalled();
  });

  it('falls through handlers that return false to the one that handles it', () => {
    const passes = registration({ priority: 10, handler: vi.fn(() => false) });
    const handles = registration({ handler: vi.fn() });
    expect(ffActionDispatch([passes, handles], 'back', alwaysActive)).toBe(
      handles,
    );
    expect(handles.handler).toHaveBeenCalled();
  });

  it('skips handlers whose element is inactive and other actions', () => {
    const hidden = registration({
      element: document.createElement('div'),
      handler: vi.fn(),
    });
    const other = registration({ action: 'confirm', handler: vi.fn() });
    expect(
      ffActionDispatch([hidden, other], 'back', () => false),
    ).toBeUndefined();
    expect(hidden.handler).not.toHaveBeenCalled();
    expect(other.handler).not.toHaveBeenCalled();
  });

  it('skips disabled handlers', () => {
    const disabled = registration({ priority: 10, enabled: () => false });
    const fallback = registration({ handler: vi.fn() });
    expect(ffActionDispatch([disabled, fallback], 'back', alwaysActive)).toBe(
      fallback,
    );
    expect(disabled.handler).not.toHaveBeenCalled();
  });
});

describe('ffActivePrompts', () => {
  it('collapses all four directions into one d-pad glyph', () => {
    const moves = (['up', 'down', 'left', 'right'] as const).map((action) =>
      registration({ action, label: 'Move' }),
    );
    expect(
      ffActivePrompts(moves, ['up', 'down', 'left', 'right'], alwaysActive),
    ).toEqual([{ actions: ['dpad'], label: 'Move' }]);
  });

  it('keeps a partial set of directions as-is', () => {
    const left = registration({ action: 'left', label: 'Adjust' });
    const right = registration({ action: 'right', label: 'Adjust' });
    expect(
      ffActivePrompts([left, right], ['left', 'right'], alwaysActive),
    ).toEqual([{ actions: ['left', 'right'], label: 'Adjust' }]);
  });

  it('labels each action from its top handler without running it', () => {
    const confirm = registration({ action: 'confirm', label: 'Next' });
    const back = registration({ label: () => 'Skip' });
    const prompts = ffActivePrompts(
      [confirm, back],
      ['confirm', 'back'],
      alwaysActive,
    );
    expect(prompts).toEqual([
      { actions: ['confirm'], label: 'Next' },
      { actions: ['back'], label: 'Skip' },
    ]);
    expect(confirm.handler).not.toHaveBeenCalled();
  });

  it('hides prompts behind an unlabeled blocker', () => {
    const page = registration({ label: 'Back' });
    const blocker = registration({ priority: 10 });
    expect(ffActivePrompts([page, blocker], ['back'], alwaysActive)).toEqual(
      [],
    );
  });

  it('merges actions that share a label even when not adjacent', () => {
    const back = registration({ label: 'Resume' });
    const pause = registration({ action: 'pause', label: 'Pause' });
    const menu = registration({ action: 'menu', label: 'Resume' });
    expect(
      ffActivePrompts(
        [back, pause, menu],
        ['back', 'pause', 'menu'],
        alwaysActive,
      ),
    ).toEqual([
      { actions: ['back', 'menu'], label: 'Resume' },
      { actions: ['pause'], label: 'Pause' },
    ]);
  });

  it('merges actions that share a label', () => {
    const prev = registration({ action: 'tabPrev', label: 'Switch View' });
    const next = registration({ action: 'tabNext', label: 'Switch View' });
    expect(
      ffActivePrompts([prev, next], ['tabPrev', 'tabNext'], alwaysActive),
    ).toEqual([{ actions: ['tabPrev', 'tabNext'], label: 'Switch View' }]);
  });
});
