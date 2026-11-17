import { computed, Directive } from '@angular/core';
import { isInElectron } from '@helpers/engine/electron';
import { hostBinding } from 'ngxtension/host-binding';

@Directive({
  selector: '[appDisableOutsideElectron]',
})
export class DisableOutsideElectronDirective {
  public disabled = hostBinding(
    'class.hidden',
    computed(() => (isInElectron() ? undefined : true)),
  );

  public disabledAttr = hostBinding(
    'attr.hidden',
    computed(() => (isInElectron() ? undefined : true)),
  );
}
