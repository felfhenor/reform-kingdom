import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { KingdomBackButtonComponent } from '@components/kingdom-back-button/kingdom-back-button.component';

@Component({
  selector: 'app-play-kingdom-achievements',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardPageComponent, KingdomBackButtonComponent],
  templateUrl: './play-kingdom-achievements.component.html',
})
export class PlayKingdomAchievementsComponent {}
