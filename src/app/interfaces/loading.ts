export type LoadingStep = {
  label: string;
  isDone: boolean;
};

export type LoadingProgress = {
  percent: number;
  label: string;
  isComplete: boolean;
};
