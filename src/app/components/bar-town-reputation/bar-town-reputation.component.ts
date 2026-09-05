import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { BarProgressComponent } from '@components/bar-progress/bar-progress.component';
import { townReputationDisplay } from '@helpers/town/reputation/town-reputation';
import type { TownId } from '@interfaces';

@Component({
  selector: 'app-bar-town-reputation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BarProgressComponent],
  template: `
    @if (display(); as repDisplay) {
      <app-bar-progress
        color="secondary"
        [value]="repDisplay.reputation"
        [max]="repDisplay.nextThreshold ?? 100"
      >
        {{ repDisplay.tierName }} [{{ repDisplay.reputation }}/{{
          repDisplay.nextThreshold ?? 100
        }}]
      </app-bar-progress>
    }
  `,
})
export class BarTownReputationComponent {
  public townId = input.required<TownId>();

  public display = computed(() => townReputationDisplay(this.townId()));
}
