import { computed, Directive } from '@angular/core';
import { isInElectron } from '@helpers/engine/electron';
import { hostBinding } from 'ngxtension/host-binding';

@Directive({
  selector: '[appHideInElectron]',
})
export class HideInElectronDirective {
  public hidden = hostBinding(
    'class.hidden',
    computed(() => isInElectron()),
  );
}
