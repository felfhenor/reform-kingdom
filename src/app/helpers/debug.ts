import { setOption } from '@helpers/state-options';

export function debugToggle() {
  setOption('showDebug', true);
}
