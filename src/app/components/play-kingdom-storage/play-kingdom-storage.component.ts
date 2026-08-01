import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { kingdomSubviewClear } from '@helpers';

@Component({
  selector: 'app-play-kingdom-storage',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardPageComponent],
  templateUrl: './play-kingdom-storage.component.html',
})
export class PlayKingdomStorageComponent {
  public back(): void {
    kingdomSubviewClear();
  }
}
