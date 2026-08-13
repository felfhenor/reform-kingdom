import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PanelPlayKingdomTradeskillComponent } from '@components/panel-play-kingdom-tradeskill/panel-play-kingdom-tradeskill.component';

@Component({
  selector: 'app-play-kingdom-tradeskill-blacksmithing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelPlayKingdomTradeskillComponent],
  template: `<app-panel-play-kingdom-tradeskill tradeskill="Blacksmithing" />`,
})
export class PlayKingdomTradeskillBlacksmithingComponent {}
