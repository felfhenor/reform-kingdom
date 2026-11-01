import { LOG_FILE_MAX_ENTRY_LENGTH } from '@helpers/config';
import {
  electronLogWrite,
  logDataToString,
} from '@helpers/engine/electron-log';
import type { WindowWithElectronLogBridge } from '@interfaces';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('logDataToString', () => {
  it('joins strings and serializes objects', () => {
    expect(logDataToString(['a', { b: 1 }, [2], 3, null])).toBe(
      'a {"b":1} [2] 3 null',
    );
  });

  it('keeps undefined and functions readable', () => {
    expect(logDataToString([undefined, () => 1])).toBe('undefined () => 1');
  });

  it('includes the stack and cause of errors', () => {
    const cause = new Error('inner');
    const err = new Error('outer', { cause });

    const text = logDataToString([err]);

    expect(text).toContain('Error: outer');
    expect(text).toContain(err.stack!.split('\n')[1].trim());
    expect(text).toContain('Caused by: Error: inner');
  });

  it('serializes errors nested in objects', () => {
    expect(logDataToString([{ e: new Error('nested') }])).toContain(
      'Error: nested',
    );
  });

  it('marks cycles instead of throwing', () => {
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic['self'] = cyclic;

    expect(logDataToString([cyclic])).toBe('{"a":1,"self":"[Circular]"}');
  });

  it('serializes shared references that are not cycles', () => {
    const shared = { x: 1 };

    expect(logDataToString([{ a: shared, b: shared }])).toBe(
      '{"a":{"x":1},"b":{"x":1}}',
    );
  });

  it('truncates oversized entries', () => {
    const text = logDataToString(['a'.repeat(LOG_FILE_MAX_ENTRY_LENGTH + 5)]);

    expect(text).toBe(
      `${'a'.repeat(LOG_FILE_MAX_ENTRY_LENGTH)}... [truncated 5 chars]`,
    );
  });

  it('handles bigints and nested functions', () => {
    expect(logDataToString([{ n: 5n, f: () => 1 }])).toBe(
      '{"n":"5n","f":"[Function]"}',
    );
  });
});

describe('electronLogWrite', () => {
  const bridgeWindow = window as WindowWithElectronLogBridge;

  afterEach(() => {
    delete bridgeWindow.reformElectron;
  });

  it('does nothing without the electron bridge', () => {
    expect(() => electronLogWrite('info', 'Test', ['x'])).not.toThrow();
  });

  it('sends the stringified data over the bridge', () => {
    const logWrite = vi.fn();
    bridgeWindow.reformElectron = { logWrite };

    electronLogWrite('warn', 'Test', ['msg', { a: 1 }]);

    expect(logWrite).toHaveBeenCalledWith('warn', 'Test', 'msg {"a":1}');
  });

  it('swallows bridge failures', () => {
    bridgeWindow.reformElectron = {
      logWrite: () => {
        throw new Error('ipc down');
      },
    };

    expect(() => electronLogWrite('error', 'Test', ['x'])).not.toThrow();
  });
});
