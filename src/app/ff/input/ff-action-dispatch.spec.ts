import { ffActionDispatch } from '@ff/input/ff-action-dispatch';
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
});
