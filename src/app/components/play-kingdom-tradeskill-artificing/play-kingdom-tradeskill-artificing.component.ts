import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { kingdomSubviewClear } from '@helpers';

@Component({
  selector: 'app-play-kingdom-tradeskill-artificing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardPageComponent],
  templateUrl: './play-kingdom-tradeskill-artificing.component.html',
})
export class PlayKingdomTradeskillArtificingComponent {
  public back(): void {
    kingdomSubviewClear();
  }
}
