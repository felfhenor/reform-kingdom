import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { kingdomSubviewClear } from '@helpers';

@Component({
  selector: 'app-play-kingdom-museum',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardPageComponent],
  templateUrl: './play-kingdom-museum.component.html',
})
export class PlayKingdomMuseumComponent {
  public back(): void {
    kingdomSubviewClear();
  }
}
