import { COMBAT_ELEMENT_CHARGES_PER_ELEMENT } from '@helpers/config';
import { defaultAffinities } from '@helpers/defaults';
import type { Combat, ElementBlock, GameElement } from '@interfaces';
import { GameElementOrder } from '@interfaces';
import { clamp } from 'es-toolkit/compat';

export function elementPool(combat: Combat): ElementBlock {
  return combat.elements ?? defaultAffinities();
}

export function elementPoolCanPay(
  pool: ElementBlock,
  costs: ElementBlock,
): boolean {
  return GameElementOrder.every((element) => pool[element] >= costs[element]);
}

export function elementPoolPay(combat: Combat, costs: ElementBlock): void {
  const pool = elementPool(combat);
  combat.elements = {
    Fire: Math.max(0, pool.Fire - costs.Fire),
    Water: Math.max(0, pool.Water - costs.Water),
    Earth: Math.max(0, pool.Earth - costs.Earth),
    Air: Math.max(0, pool.Air - costs.Air),
  };
}

export function elementPoolFill(combat: Combat, elements: GameElement[]): void {
  const pool = { ...elementPool(combat) };
  elements.forEach((element) => {
    pool[element] = clamp(
      pool[element] + 1,
      0,
      COMBAT_ELEMENT_CHARGES_PER_ELEMENT,
    );
  });
  combat.elements = pool;
}

export function elementBlockText(block: ElementBlock): string {
  return GameElementOrder.filter((element) => block[element] > 0)
    .map((element) => `${block[element]} ${element}`)
    .join(', ');
}
