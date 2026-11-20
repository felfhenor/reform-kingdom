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

export function cycleStep<T>(items: T[], current: T, direction: 1 | -1): T {
  const index = items.indexOf(current);
  if (index === -1) return items[0];
  return items[(index + direction + items.length) % items.length];
}
