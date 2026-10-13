import { isGlobalEffectActive } from '@helpers/hero/global-effects';
import { jobAbilityValue } from '@helpers/hero/job-ability';
import { updateGamestate, worldCombatState } from '@helpers/state-game';
import type { Character, GlobalEffectId } from '@interfaces';
import { clamp } from 'es-toolkit/compat';

function canRegenOutOfCombat(): boolean {
  return (
    !worldCombatState() &&
    !isGlobalEffectActive('Deaths Door' as GlobalEffectId) &&
    !isGlobalEffectActive('Healing' as GlobalEffectId)
  );
}

function regenStat(current: number, max: number, amount: number): number {
  if (current >= max) return current;
  return clamp(current + amount, 0, max);
}

// Returns the same character when nothing regenerates, so a full party doesn't churn the party slice every tick.
function regeneratedCharacter(
  character: Character,
  hpAmount: number,
  epAmount: number,
): Character {
  const hp = regenStat(character.hp, character.stats.Health, hpAmount);
  const ep = regenStat(character.ep, character.stats.Energy, epAmount);
  if (hp === character.hp && ep === character.ep) return character;

  return { ...character, hp, ep };
}

// Runs once per tick - stacks with resting regen, and works while traveling or gathering too.
export function jobAbilityRegenProcessTick(): void {
  if (!canRegenOutOfCombat()) return;

  const hpAmount = jobAbilityValue('RestoreHealthOOC');
  const epAmount = jobAbilityValue('RestoreEnergyOOC');
  if (hpAmount === 0 && epAmount === 0) return;

  updateGamestate((state) => {
    const party = state.world.party.map((character) =>
      regeneratedCharacter(character, hpAmount, epAmount),
    );
    const changed = party.some(
      (character, index) => character !== state.world.party[index],
    );
    if (changed) state.world.party = party;

    return state;
  });
}
