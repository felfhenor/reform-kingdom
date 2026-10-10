import {
  elementBlockText,
  elementPool,
  elementPoolCanPay,
  elementPoolFill,
  elementPoolPay,
} from '@helpers/combat/combat-element-pool';
import type { ElementBlock } from '@interfaces';
import { buildCombat } from '@/testing/builders';
import { describe, expect, it } from 'vitest';

function block(overrides: Partial<ElementBlock> = {}): ElementBlock {
  return { Fire: 0, Water: 0, Earth: 0, Air: 0, ...overrides };
}

describe('elementPool', () => {
  it('treats a missing pool as empty', () => {
    const combat = buildCombat();
    delete combat.elements;

    expect(elementPool(combat)).toEqual(block());
  });
});

describe('elementPoolFill', () => {
  it('adds one charge per element and clamps at the cap', () => {
    const combat = buildCombat({ elements: block({ Fire: 1, Air: 2 }) });

    elementPoolFill(combat, ['Fire', 'Earth', 'Air']);
    elementPoolFill(combat, ['Fire']);

    expect(combat.elements).toEqual(block({ Fire: 2, Earth: 1, Air: 2 }));
  });
});

describe('elementPoolCanPay / elementPoolPay', () => {
  it('pays only when every element is covered', () => {
    const pool = block({ Water: 1, Earth: 1 });

    expect(elementPoolCanPay(pool, block({ Water: 1, Earth: 1 }))).toBe(true);
    expect(elementPoolCanPay(pool, block({ Water: 2 }))).toBe(false);
  });

  it('subtracts the costs', () => {
    const combat = buildCombat({ elements: block({ Fire: 2, Water: 1 }) });

    elementPoolPay(combat, block({ Fire: 2 }));

    expect(combat.elements).toEqual(block({ Water: 1 }));
  });
});

describe('elementBlockText', () => {
  it('lists only nonzero elements in display order', () => {
    expect(elementBlockText(block({ Air: 1, Fire: 2 }))).toBe('2 Fire, 1 Air');
  });
});
