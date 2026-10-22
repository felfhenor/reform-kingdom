import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { CardStatusBubbleComponent } from '@components/card-status-bubble/card-status-bubble.component';
import { formatDuration } from '@helpers/engine/timer';
import { formatDurationBadge } from '@helpers/engine/timer.ui';
import { kingdomSubviewShow, setGamePlayView } from '@helpers/engine/ui';
import type { CraftingStatusEntry, KingdomSubview } from '@interfaces';

@Component({
  selector: 'app-card-status-crafting',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AtlasImageComponent, CardStatusBubbleComponent],
  templateUrl: './card-status-crafting.component.html',
  styleUrl: './card-status-crafting.component.scss',
})
export class CardStatusCraftingComponent {
  public entry = input.required<CraftingStatusEntry>();
  public expanded = input<boolean>(false);

  public formatDuration = formatDuration;
  public formatDurationBadge = formatDurationBadge;

  public goToTradeskill() {
    setGamePlayView('kingdom');
    kingdomSubviewShow(
      `tradeskill-${this.entry().tradeskill.toLowerCase()}` as KingdomSubview,
    );
  }
}
