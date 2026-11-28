import { TPipe } from '@pipes/t.pipe';
import { FFButtonComponent } from '@ff/components/button/button.component';
import type { FFGamepadAction } from '@ff/interfaces/ff-input';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { formatDuration } from '@helpers/engine/timer';
import { travelStart } from '@helpers/hero/travel';

@Component({
  selector: 'app-button-travel-here',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe, FFButtonComponent],
  templateUrl: './button-travel-here.component.html',
})
export class ButtonTravelHereComponent {
  public nodeName = input.required<string>();
  public canTravel = input.required<boolean>();
  public etaSeconds = input<number>();
  // Set where the button sits in a pad-focusable row.
  public padAction = input<FFGamepadAction>();

  public etaLabel = computed(() => {
    const seconds = this.etaSeconds();
    return seconds === undefined ? undefined : formatDuration(seconds);
  });

  public travel(): void {
    travelStart(this.nodeName());
  }
}
