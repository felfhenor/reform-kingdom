import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { kingdomSubviewClear } from '@helpers';

@Component({
  selector: 'app-play-kingdom-astralprojector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardPageComponent],
  templateUrl: './play-kingdom-astralprojector.component.html',
})
export class PlayKingdomAstralProjectorComponent {
  public back(): void {
    kingdomSubviewClear();
  }
}
