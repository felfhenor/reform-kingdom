import { NODE_FORGOTTEN_ALPHA } from '@helpers/config';
import { pixiNodeSprite } from '@helpers/pixi/pixi-map-render';
import type { Container } from 'pixi.js';
import { ColorMatrixFilter } from 'pixi.js';

let forgottenFilter: ColorMatrixFilter | undefined;

// Shared by every forgotten node, and made on first use so importing this never builds a filter.
function nodeForgottenFilter(): ColorMatrixFilter {
  if (!forgottenFilter) {
    forgottenFilter = new ColorMatrixFilter();
    forgottenFilter.desaturate();
  }
  return forgottenFilter;
}

// Only the sprite fades, so labels and status icons keep their own visibility.
export function pixiNodeForgottenSet(
  wrapper: Container,
  forgotten: boolean,
): void {
  const sprite = pixiNodeSprite(wrapper);
  const alpha = forgotten ? NODE_FORGOTTEN_ALPHA : 1;
  if (!sprite || sprite.alpha === alpha) return;

  sprite.alpha = alpha;
  sprite.filters = forgotten ? [nodeForgottenFilter()] : [];
}
