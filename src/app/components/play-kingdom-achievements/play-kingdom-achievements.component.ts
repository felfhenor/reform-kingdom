import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { ButtonKingdomBackComponent } from '@components/button-kingdom-back/button-kingdom-back.component';

@Component({
  selector: 'app-play-kingdom-achievements',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BlankSlateComponent, CardPageComponent, ButtonKingdomBackComponent],
  templateUrl: './play-kingdom-achievements.component.html',
})
export class PlayKingdomAchievementsComponent {}
