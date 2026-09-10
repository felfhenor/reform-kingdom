import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { BarProgressComponent } from '@components/bar-progress/bar-progress.component';
import {
  worldNodeExploreRandomIsAvailable,
  worldNodeExploreRandomTimerText,
} from '@helpers/world-node/world-node-encounter';
import { worldNodeEncounterProgress } from '@helpers/world-node/world-node-encounter.ui';
import { worldNodeEncounterRandom } from '@helpers/world-node/world-nodes';
import type { WorldNodeEntry } from '@interfaces';

@Component({
  selector: 'app-panel-map-node-status-encounter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, BarProgressComponent],
  templateUrl: './panel-map-node-status-encounter.component.html',
  styleUrl: './panel-map-node-status-encounter.component.scss',
})
export class PanelMapNodeStatusEncounterComponent {
  public entry = input.required<WorldNodeEntry>();

  public progress = computed(() => worldNodeEncounterProgress(this.entry()));

  public progressPercent = computed(() => {
    const progress = this.progress();
    return progress ? Math.round(progress.fraction * 100) : 0;
  });

  public exploreRandomTimerText = computed(() =>
    worldNodeExploreRandomTimerText(this.entry()),
  );

  public isExploreRandomCleared = computed(() => {
    const entry = this.entry();
    return (
      !!worldNodeEncounterRandom(entry) &&
      !worldNodeExploreRandomIsAvailable(entry)
    );
  });
}
