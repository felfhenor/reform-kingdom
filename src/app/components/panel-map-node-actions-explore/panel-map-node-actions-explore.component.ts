import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { SFXDirective } from '@directives/sfx.directive';
import {
  worldNodeExploreRandomIsAvailable,
  worldNodeExploreRandomTimerText,
} from '@helpers/world-node-encounter';
import { worldNodeEncounterRandom } from '@helpers/world-nodes';
import type { WorldNodeEntry } from '@interfaces';

@Component({
  selector: 'app-panel-map-node-actions-explore',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SFXDirective],
  templateUrl: './panel-map-node-actions-explore.component.html',
  styleUrl: './panel-map-node-actions-explore.component.scss',
})
export class PanelMapNodeActionsExploreComponent {
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
