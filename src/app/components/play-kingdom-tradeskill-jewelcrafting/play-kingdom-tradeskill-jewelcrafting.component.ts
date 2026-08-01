import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { kingdomSubviewClear } from '@helpers';

@Component({
  selector: 'app-play-kingdom-tradeskill-jewelcrafting',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardPageComponent],
  templateUrl: './play-kingdom-tradeskill-jewelcrafting.component.html',
})
export class PlayKingdomTradeskillJewelcraftingComponent {
  public back(): void {
    kingdomSubviewClear();
  }
}
