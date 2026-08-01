import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { kingdomSubviewClear } from '@helpers';

@Component({
  selector: 'app-play-kingdom-prestige',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardPageComponent],
  templateUrl: './play-kingdom-prestige.component.html',
})
export class PlayKingdomPrestigeComponent {
  public back(): void {
    kingdomSubviewClear();
  }
}
