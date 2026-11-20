import type { GamePlayView } from '@interfaces';

const GAMEPLAY_VIEW_ORDER: GamePlayView[] = [
  'world',
  'kingdom',
  'heroes',
  'adventurelog',
  'decree',
  'town',
];

export function gamePlayViewsCyclable(
  hasTown: boolean,
  decreeRevealed: boolean,
): GamePlayView[] {
  return GAMEPLAY_VIEW_ORDER.filter(
    (view) =>
      (view !== 'town' || hasTown) && (view !== 'decree' || decreeRevealed),
  );
}

export function gamePlayViewStep(
  views: GamePlayView[],
  current: GamePlayView,
  direction: 1 | -1,
): GamePlayView {
  const index = views.indexOf(current);
  if (index === -1) return views[0];
  return views[(index + direction + views.length) % views.length];
}
