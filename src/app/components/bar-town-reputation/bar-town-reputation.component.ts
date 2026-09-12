import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { BarProgressComponent } from '@components/bar-progress/bar-progress.component';
import { townReputationDisplay } from '@helpers/town/reputation/town-reputation.ui';
import type { TownId } from '@interfaces';

@Component({
  selector: 'app-bar-town-reputation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BarProgressComponent, DecimalPipe],
  template: `
    @if (display(); as repDisplay) {
      <app-bar-progress
        color="secondary"
        [value]="repDisplay.reputation"
        [max]="repDisplay.nextThreshold ?? repDisplay.reputation"
      >
        @if (repDisplay.isMaxed) {
          {{ repDisplay.tierName }}
        } @else {
          {{ repDisplay.tierName }} [{{ repDisplay.reputation | number }}/{{
            repDisplay.nextThreshold | number
          }}]
        }
      </app-bar-progress>
    }
  `,
})
export class BarTownReputationComponent {
  public townId = input.required<TownId>();

  public display = computed(() => townReputationDisplay(this.townId()));
}
