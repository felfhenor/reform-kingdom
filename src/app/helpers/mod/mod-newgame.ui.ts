import { isDemoBuild } from '@helpers/demo/demo';
import { notifyError } from '@helpers/engine/notify';
import { modsReset } from '@helpers/mod/mod-apply';
import { modsApplyEnabled } from '@helpers/savefile/savefile-mods';
import { getOption } from '@helpers/state-options';

// Applied on entering setup, so the job and edict pickers already see mod content.
export function modsApplyForNewGame(): void {
  if (isDemoBuild()) return;

  const errors = modsApplyEnabled(getOption('modsEnabled'));
  if (errors.length === 0) return;

  modsReset();
  notifyError(
    `Your enabled mods could not be applied. This run will start without them. ${errors.join(' ')}`,
  );
}
