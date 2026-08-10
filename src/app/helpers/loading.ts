import type { LoadingProgress, LoadingStep } from '@interfaces';

export function loadingProgressCalculate(steps: LoadingStep[]): LoadingProgress {
  if (steps.length === 0) {
    return { percent: 100, label: 'Ready', isComplete: true };
  }

  const doneCount = steps.filter((step) => step.isDone).length;
  const activeStep = steps.find((step) => !step.isDone);

  return {
    percent: Math.round((doneCount / steps.length) * 100),
    label: activeStep?.label ?? 'Ready',
    isComplete: doneCount === steps.length,
  };
}
