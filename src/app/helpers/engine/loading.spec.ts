import { loadingProgressCalculate } from '@helpers/engine/loading';
import type { LoadingStep } from '@interfaces';
import { describe, expect, it } from 'vitest';

describe('loadingProgressCalculate', () => {
  it('reports 100% and complete when there are no steps', () => {
    expect(loadingProgressCalculate([])).toEqual({
      percent: 100,
      label: 'Ready',
      isComplete: true,
    });
  });

  it('reports the first incomplete step label and partial percent', () => {
    const steps: LoadingStep[] = [
      { label: 'Loading content...', isDone: true },
      { label: 'Loading art...', isDone: false },
      { label: 'Loading maps...', isDone: false },
      { label: 'Loading save...', isDone: false },
    ];

    expect(loadingProgressCalculate(steps)).toEqual({
      percent: 25,
      label: 'Loading art...',
      isComplete: false,
    });
  });

  it('reports Ready and 100% once every step is done', () => {
    const steps: LoadingStep[] = [
      { label: 'Loading content...', isDone: true },
      { label: 'Loading art...', isDone: true },
    ];

    expect(loadingProgressCalculate(steps)).toEqual({
      percent: 100,
      label: 'Ready',
      isComplete: true,
    });
  });
});
