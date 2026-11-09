import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { SFXDirective } from '@directives/sfx.directive';
import { formatDuration } from '@helpers/engine/timer';
import { travelStart } from '@helpers/hero/travel';

@Component({
  selector: 'app-button-travel-here',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SFXDirective],
  templateUrl: './button-travel-here.component.html',
})
export class ButtonTravelHereComponent {
  public nodeName = input.required<string>();
  public canTravel = input.required<boolean>();
  public etaSeconds = input<number>();

  public etaLabel = computed(() => {
    const seconds = this.etaSeconds();
    return seconds === undefined ? undefined : formatDuration(seconds);
  });

  public travel(): void {
    travelStart(this.nodeName());
  }
}
