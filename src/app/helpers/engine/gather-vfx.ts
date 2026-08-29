import { isPageVisible } from '@helpers/engine/page-visibility';
import type { GatherVfxEvent } from '@interfaces';
import { Subject } from 'rxjs';

const gatherVfx = new Subject<GatherVfxEvent>();
export const gatherVfx$ = gatherVfx.asObservable();

export function gatherVfxEmit(event: GatherVfxEvent): void {
  if (!isPageVisible()) return;

  gatherVfx.next(event);
}
