import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('es-toolkit', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  delay: vi.fn(() => Promise.resolve()),
}));

vi.mock('@helpers/engine/idb', () => ({
  idbIsAvailable: vi.fn(() => true),
  idbGet: vi.fn(),
  idbPut: vi.fn(() => Promise.resolve()),
}));

vi.mock('@helpers/engine/logging', () => ({
  error: vi.fn(),
}));

import { idbGet, idbPut } from '@helpers/engine/idb';
import { indexedDbSignal } from '@helpers/engine/signal';

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('indexedDbSignal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the stored value', async () => {
    vi.mocked(idbGet).mockResolvedValueOnce('stored');
    const onLoad = vi.fn();

    const value = indexedDbSignal('key', 'initial', onLoad);
    await flush();

    expect(value()).toBe('stored');
    expect(onLoad).toHaveBeenCalledExactlyOnceWith('stored');
  });

  it('falls back to the initial value when nothing is stored', async () => {
    vi.mocked(idbGet).mockResolvedValueOnce(undefined);
    const onLoad = vi.fn();

    indexedDbSignal('key', 'initial', onLoad);
    await flush();

    expect(onLoad).toHaveBeenCalledExactlyOnceWith('initial');
  });

  it('retries a failed read before giving up', async () => {
    vi.mocked(idbGet)
      .mockRejectedValueOnce(new Error('busy'))
      .mockResolvedValueOnce('stored');
    const onLoad = vi.fn();
    const onError = vi.fn();

    indexedDbSignal('key', 'initial', onLoad, onError);
    await flush();

    expect(idbGet).toHaveBeenCalledTimes(2);
    expect(onLoad).toHaveBeenCalledWith('stored');
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports an error, not a load, after every read attempt fails', async () => {
    const failure = new Error('gone');
    vi.mocked(idbGet).mockRejectedValue(failure);
    const onLoad = vi.fn();
    const onError = vi.fn();

    indexedDbSignal('key', 'initial', onLoad, onError);
    await flush();

    expect(idbGet).toHaveBeenCalledTimes(3);
    expect(onLoad).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledExactlyOnceWith(failure);

    vi.mocked(idbGet).mockReset();
  });

  it('does not write anything before the initial read finishes', () => {
    vi.mocked(idbGet).mockReturnValueOnce(new Promise(() => undefined));

    const value = indexedDbSignal('key', 'initial');
    value.set('early');

    expect(idbPut).not.toHaveBeenCalled();
  });

  it('reports a failed write', async () => {
    vi.mocked(idbGet).mockResolvedValueOnce('stored');
    const failure = new Error('quota');
    vi.mocked(idbPut).mockRejectedValueOnce(failure);
    const onSaveError = vi.fn();

    const value = indexedDbSignal(
      'key',
      'initial',
      undefined,
      undefined,
      onSaveError,
    );
    await flush();
    value.set('next');
    await flush();

    expect(onSaveError).toHaveBeenCalledExactlyOnceWith(failure);
  });
});
