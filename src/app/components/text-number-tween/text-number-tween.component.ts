import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { injectTweenedNumber } from '@services/animation.service';

@Component({
  selector: 'app-text-number-tween',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'tabular-nums' },
  template: `
    {{ displayValue() | number: format() }}
  `,
})
export class TextNumberTweenComponent {
  public value = input.required<number>();
  public format = input('1.0-0');
  public animate = input(true);

  public displayValue = injectTweenedNumber(
    () => this.value(),
    () => this.animate(),
  );
}
