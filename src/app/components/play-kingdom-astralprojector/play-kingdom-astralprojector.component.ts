import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { ButtonKingdomBackComponent } from '@components/button-kingdom-back/button-kingdom-back.component';

@Component({
  selector: 'app-play-kingdom-astralprojector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardPageComponent, ButtonKingdomBackComponent],
  templateUrl: './play-kingdom-astralprojector.component.html',
})
export class PlayKingdomAstralProjectorComponent {}
