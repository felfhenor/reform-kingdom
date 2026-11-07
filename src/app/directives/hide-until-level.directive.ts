import { computed, Directive, input } from '@angular/core';
import { hostBinding } from 'ngxtension/host-binding';
import { partyMaxLevel } from '@helpers/item/gathering';
import { globalEffectSumsState } from '@helpers/state-game';

@Directive({
  selector: '[appHideUntilLevel]',
})
export class HideUntilLevelDirective {
  public appHideUntilLevel = input.required<number>();

  public hidden = hostBinding(
    'class.hidden',
    computed(
      () =>
        !globalEffectSumsState().featuresRevealed &&
        partyMaxLevel() < this.appHideUntilLevel(),
    ),
  );
}
