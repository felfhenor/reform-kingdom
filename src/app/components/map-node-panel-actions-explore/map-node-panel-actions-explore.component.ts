import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { SFXDirective } from '@directives/sfx.directive';
import {
  worldNodeEncounterRandom,
  worldNodeExploreRandomIsAvailable,
  worldNodeExploreRandomTimerText,
} from '@helpers';
import type { WorldNodeEntry } from '@interfaces';

@Component({
  selector: 'app-map-node-panel-actions-explore',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SFXDirective],
  templateUrl: './map-node-panel-actions-explore.component.html',
  styleUrl: './map-node-panel-actions-explore.component.scss',
})
export class MapNodePanelActionsExploreComponent {
  public entry = input.required<WorldNodeEntry>();
  public canReExplore = input.required<boolean>();

  public reExplore = output<void>();

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
