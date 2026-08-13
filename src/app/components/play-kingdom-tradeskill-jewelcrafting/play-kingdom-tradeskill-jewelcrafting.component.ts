import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PanelPlayKingdomTradeskillComponent } from '@components/panel-play-kingdom-tradeskill/panel-play-kingdom-tradeskill.component';

@Component({
  selector: 'app-play-kingdom-tradeskill-jewelcrafting',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelPlayKingdomTradeskillComponent],
  template: `<app-panel-play-kingdom-tradeskill tradeskill="Jewelcrafting" />`,
})
export class PlayKingdomTradeskillJewelcraftingComponent {}
