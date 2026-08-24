import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { formatDuration } from '@helpers/engine/timer';
import type { CraftingStatusEntry } from '@interfaces';

@Component({
  selector: 'app-card-status-crafting',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AtlasImageComponent],
  templateUrl: './card-status-crafting.component.html',
  styleUrl: './card-status-crafting.component.scss',
})
export class CardStatusCraftingComponent {
  public entry = input.required<CraftingStatusEntry>();
  public expanded = input<boolean>(false);

  public formatDuration = formatDuration;
}
