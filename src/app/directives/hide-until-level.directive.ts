import { computed, Directive, input } from '@angular/core';
import { hostBinding } from 'ngxtension/host-binding';
import { isRevealedAtLevel } from '@helpers/engine/feature-reveal';

@Directive({
  selector: '[appHideUntilLevel]',
})
export class HideUntilLevelDirective {
  public appHideUntilLevel = input.required<number>();

  public hidden = hostBinding(
    'class.hidden',
    computed(() => !isRevealedAtLevel(this.appHideUntilLevel())),
  );
}
