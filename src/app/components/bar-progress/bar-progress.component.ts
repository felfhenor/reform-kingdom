import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import type { DaisyColor } from '@interfaces';

// Tailwind's class scanner only picks up literal strings, so the color->class
// mapping can't be built with a template literal - it would purge every progress-* class.
const PROGRESS_COLOR_CLASSES: Record<DaisyColor, string> = {
  primary: 'progress-primary',
  secondary: 'progress-secondary',
  accent: 'progress-accent',
  neutral: 'progress-neutral',
  info: 'progress-info',
  success: 'progress-success',
  warning: 'progress-warning',
  error: 'progress-error',
};

@Component({
  selector: 'app-bar-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bar-progress.component.html',
  host: {
    class: 'relative block',
  },
})
export class BarProgressComponent {
  public value = input.required<number>();
  public max = input(100);
  public color = input<DaisyColor>('primary');
  public text = input<string>();

  public colorClass = computed(() => PROGRESS_COLOR_CLASSES[this.color()]);
}
