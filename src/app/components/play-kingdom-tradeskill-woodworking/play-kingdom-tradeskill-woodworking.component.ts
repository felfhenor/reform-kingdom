import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { kingdomSubviewClear } from '@helpers';

@Component({
  selector: 'app-play-kingdom-tradeskill-woodworking',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardPageComponent],
  templateUrl: './play-kingdom-tradeskill-woodworking.component.html',
})
export class PlayKingdomTradeskillWoodworkingComponent {
  public back(): void {
    kingdomSubviewClear();
  }
}
