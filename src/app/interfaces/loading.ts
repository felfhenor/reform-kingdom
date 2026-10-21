import type { AtlasedImage } from '@interfaces/artable';

export type LoadingStep = {
  label: string;
  isDone: boolean;
};

export type LoadingProgress = {
  percent: number;
  label: string;
  isComplete: boolean;
};

export type LoadingIcon = {
  spritesheet: AtlasedImage;
  x: number;
  y: number;
};
