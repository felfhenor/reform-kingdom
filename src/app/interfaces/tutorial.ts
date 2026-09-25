import type { GamePlayView, KingdomSubview } from '@interfaces/ui';

export type TutorialId = string;

export type TutorialStep = {
  targetKey: string;
  view: GamePlayView;
  subview?: KingdomSubview;
  title: string;
  body: string;
};

export type TutorialTrigger =
  | { kind: 'game-start' }
  | { kind: 'first-worker' }
  | { kind: 'first-infusion-material' }
  | { kind: 'party-level'; level: number }
  | { kind: 'first-town-visit' }
  | { kind: 'first-caravan-visit' }
  | { kind: 'first-trainer-visit' };

export type TutorialDefinition = {
  id: TutorialId;
  name: string;
  trigger: TutorialTrigger;
  steps: TutorialStep[];
};

// Display-only shape for one corner "new feature unlocked" card.
export type TutorialUnlockStatusEntry = {
  tutorialId: TutorialId;
  name: string;
};
