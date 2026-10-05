import type { GamePlayView, KingdomSubview } from '@interfaces/ui';

export type TutorialId = string;

// Untargeted steps render centered and never navigate, so they can never auto-trigger either.
export type TutorialStep = { title: string; body: string } & (
  | { targetKey: string; view: GamePlayView; subview?: KingdomSubview }
  | { targetKey?: undefined; view?: undefined; subview?: undefined }
);

export type TutorialTrigger =
  | { kind: 'game-start' }
  | { kind: 'first-worker' }
  | { kind: 'first-infusion-material' }
  | { kind: 'first-reforge-reagent' }
  | { kind: 'party-level'; level: number }
  | { kind: 'first-town-visit' }
  | { kind: 'first-caravan-visit' }
  | { kind: 'first-trainer-visit' }
  | { kind: 'losing-streak'; losses: number; belowLevel: number };

export type TutorialDefinition = {
  id: TutorialId;
  name: string;
  trigger: TutorialTrigger;
  steps: TutorialStep[];
  // Un-marked as seen once its trigger stops holding, so it comes back the next time the situation does.
  repeatable?: boolean;
};

// Display-only shape for one corner "new feature unlocked" card.
export type TutorialUnlockStatusEntry = {
  tutorialId: TutorialId;
  name: string;
};
