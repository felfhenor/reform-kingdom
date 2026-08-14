import { computed, Directive } from '@angular/core';
import { isSetup } from '@helpers/setup';
import { hostBinding } from 'ngxtension/host-binding';

@Directive({
  selector: '[appRequireNotSetup]',
})
export class RequireNotSetupDirective {
  public hidden = hostBinding(
    'class.hidden',
    computed(() => isSetup()),
  );
}
