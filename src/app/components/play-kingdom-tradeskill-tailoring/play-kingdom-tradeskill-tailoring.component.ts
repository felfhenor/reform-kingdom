import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { kingdomSubviewClear } from '@helpers';

@Component({
  selector: 'app-play-kingdom-tradeskill-tailoring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardPageComponent],
  templateUrl: './play-kingdom-tradeskill-tailoring.component.html',
})
export class PlayKingdomTradeskillTailoringComponent {
  public back(): void {
    kingdomSubviewClear();
  }
}
