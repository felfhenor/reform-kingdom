import { isPageVisible } from '@helpers/engine/page-visibility';
import { Subject } from 'rxjs';

const heroLevelUpVfx = new Subject<string>();
export const heroLevelUpVfx$ = heroLevelUpVfx.asObservable();

export function heroLevelUpVfxEmit(characterId: string): void {
  if (!isPageVisible()) return;

  heroLevelUpVfx.next(characterId);
}
