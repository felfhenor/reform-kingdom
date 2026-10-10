import type { ElementBlock, GameElement } from '@interfaces';
import { GameElementOrder } from '@interfaces';

export function elementBlockCharges(block: ElementBlock): GameElement[] {
  return GameElementOrder.flatMap((element) =>
    Array.from({ length: block[element] }, () => element),
  );
}
