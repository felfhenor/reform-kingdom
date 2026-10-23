import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { ShimmerDirective } from '@directives/shimmer.directive';
import type { ProgressBarColor, ProgressBarSize } from '@interfaces';
import { clamp } from 'es-toolkit/compat';

// Tailwind's class scanner only picks up literal strings, so the color->class
// mapping can't be built with a template literal - it would purge every text-* class.
const PROGRESS_COLOR_CLASSES: Record<ProgressBarColor, string> = {
  primary: 'text-primary',
  neutral: 'text-neutral',
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
  hp: 'text-hp',
  ep: 'text-ep',
  xp: 'text-xp',
  reputation: 'text-reputation',
  shield: 'text-shield',
  muted: 'text-base-content/40',
};

const PROGRESS_SIZE_CLASSES: Record<ProgressBarSize, string> = {
  default: 'h-2',
  sm: 'h-1',
  md: 'h-2.5',
};

@Component({
  selector: 'app-bar-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ShimmerDirective],
  templateUrl: './bar-progress.component.html',
  host: {
    class: 'relative block w-full',
  },
})
export class BarProgressComponent {
  public value = input.required<number>();
  public max = input(100);
  public color = input<ProgressBarColor>('primary');
  public size = input<ProgressBarSize>('default');
  public shimmer = input(false);

  public colorClass = computed(() => PROGRESS_COLOR_CLASSES[this.color()]);
  public sizeClass = computed(() => PROGRESS_SIZE_CLASSES[this.size()]);
  public fillScale = computed(() =>
    clamp(this.value() / this.max(), 0, 1),
  );
}
