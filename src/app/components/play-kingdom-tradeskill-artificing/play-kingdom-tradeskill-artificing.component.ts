import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PlayKingdomTradeskillPanelComponent } from '@components/play-kingdom-tradeskill-panel/play-kingdom-tradeskill-panel.component';

@Component({
  selector: 'app-play-kingdom-tradeskill-artificing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlayKingdomTradeskillPanelComponent],
  template: `<app-play-kingdom-tradeskill-panel tradeskill="Artificing" />`,
})
export class PlayKingdomTradeskillArtificingComponent {}
