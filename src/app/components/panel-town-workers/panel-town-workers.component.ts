import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { AtlasAnimationComponent } from '@components/atlas-animation/atlas-animation.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { SpriteNodeComponent } from '@components/sprite-node/sprite-node.component';
import {
  townWorkerRosterEntries,
  townWorkerStatusDisplay,
} from '@helpers/town/worker/town-worker-roster';
import type {
  TownContent,
  TownWorkerRosterEntry,
  TownWorkerStatusDisplay,
} from '@interfaces';

@Component({
  selector: 'app-panel-town-workers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasAnimationComponent,
    SlotIconBlankComponent,
    SpriteNodeComponent,
  ],
  templateUrl: './panel-town-workers.component.html',
})
export class PanelTownWorkersComponent {
  public town = input.required<TownContent>();

  public workers = computed(() => townWorkerRosterEntries(this.town().id));

  public workerStatusDisplay(
    entry: TownWorkerRosterEntry,
  ): TownWorkerStatusDisplay {
    return townWorkerStatusDisplay(this.town(), entry.status);
  }
}
