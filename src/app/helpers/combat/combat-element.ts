import {
  ELEMENT_RESISTANCE_MAX,
  ELEMENT_RESISTANCE_MIN,
} from '@helpers/config';
import type {
  Combatant,
  ElementBlock,
  EquipmentSkillContentTechnique,
  GameElement,
} from '@interfaces';
import { clamp, mean } from 'es-toolkit/compat';

export function elementalResistanceClamp(block: ElementBlock): ElementBlock {
  return mapElementBlock(block, (value) =>
    clamp(value, ELEMENT_RESISTANCE_MIN, ELEMENT_RESISTANCE_MAX),
  );
}

export function elementalBoonFloor(block: ElementBlock): ElementBlock {
  return mapElementBlock(block, (value) => Math.max(0, value));
}

function mapElementBlock(
  block: ElementBlock,
  fn: (value: number) => number,
): ElementBlock {
  return {
    Fire: fn(block.Fire),
    Water: fn(block.Water),
    Earth: fn(block.Earth),
    Air: fn(block.Air),
  };
}

export function combatTechniqueElements(
  attacker: Pick<Combatant, 'gearElements'>,
  technique: Pick<EquipmentSkillContentTechnique, 'elements'>,
): GameElement[] {
  if (technique.elements.length > 0) return technique.elements;
  return attacker.gearElements ?? [];
}

export function elementalBoonMultiplier(
  attacker: Pick<Combatant, 'affinity'>,
  elements: GameElement[],
): number {
  if (elements.length === 0) return 1;
  return mean(elements.map((el) => (100 + attacker.affinity[el]) / 100));
}

export function elementalResistMultiplier(
  target: Pick<Combatant, 'resistance'>,
  elements: GameElement[],
): number {
  if (elements.length === 0) return 1;
  return mean(elements.map((el) => (100 - target.resistance[el]) / 100));
}

// Averaged per element, so a Fire/Water hit on a Fire-resistant target still lands its Water half.
// Integer percent math keeps e.g. 1.2 * 1.5 from flooring to 179 instead of 180.
export function elementalDamageMultiplier(
  attacker: Pick<Combatant, 'affinity'>,
  target: Pick<Combatant, 'resistance'>,
  elements: GameElement[],
): number {
  if (elements.length === 0) return 1;
  return mean(
    elements.map(
      (el) =>
        ((100 + attacker.affinity[el]) * (100 - target.resistance[el])) / 10000,
    ),
  );
}

export function elementalDamageText(
  damage: number,
  elements: GameElement[],
): string {
  return elements.length > 0
    ? `${damage} ${elements.join('/')} damage`
    : `${damage} damage`;
}
