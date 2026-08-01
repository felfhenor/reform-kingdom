import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { kingdomSubviewClear } from '@helpers';

@Component({
  selector: 'app-play-kingdom-tradeskill-blacksmithing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardPageComponent],
  templateUrl: './play-kingdom-tradeskill-blacksmithing.component.html',
})
export class PlayKingdomTradeskillBlacksmithingComponent {
  public back(): void {
    kingdomSubviewClear();
  }
}
