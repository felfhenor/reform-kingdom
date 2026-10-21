import type { StatusCardBar } from '@interfaces';

// An active shield takes the HP bar's place until it breaks.
export function combatantHealthBar(
  hp: number,
  maxHp: number,
  shield = 0,
): StatusCardBar {
  return shield > 0
    ? { variant: 'shield', current: shield, max: Math.max(maxHp, shield) }
    : { variant: 'hp', current: hp, max: maxHp };
}
