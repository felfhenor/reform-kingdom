import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
} from '@angular/core';
import { BarTownReputationComponent } from '@components/bar-town-reputation/bar-town-reputation.component';
import { ButtonTownHomeComponent } from '@components/button-town-home/button-town-home.component';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { PanelTownCraftingComponent } from '@components/panel-town-crafting/panel-town-crafting.component';
import { PanelTownQuestsComponent } from '@components/panel-town-quests/panel-town-quests.component';
import { PanelTownRaidComponent } from '@components/panel-town-raid/panel-town-raid.component';
import { PanelTownShopComponent } from '@components/panel-town-shop/panel-town-shop.component';
import { PanelTownWorkersComponent } from '@components/panel-town-workers/panel-town-workers.component';
import { activeTownNode, setGamePlayView } from '@helpers/engine/ui';
import { worldNodeTown } from '@helpers/world-node/world-nodes';
import { ContentService } from '@services/content.service';

@Component({
  selector: 'app-game-play-town',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardPageComponent,
    DecimalPipe,
    BarTownReputationComponent,
    ButtonTownHomeComponent,
    PanelTownShopComponent,
    PanelTownCraftingComponent,
    PanelTownWorkersComponent,
    PanelTownQuestsComponent,
    PanelTownRaidComponent,
  ],
  templateUrl: './game-play-town.component.html',
})
export class GamePlayTownComponent {
  private contentService = inject(ContentService);

  public entry = computed(() => activeTownNode());

  public town = computed(() => {
    const entry = this.entry();
    return entry ? worldNodeTown(entry) : undefined;
  });

  // Falls back to World if this view is reached with no town content to show. Gated on content being loaded so a fresh page reload (where content hasn't finished fetching yet) doesn't misread "not loaded" as "not available" and bounce away from a town that's actually still valid.
  constructor() {
    effect(() => {
      if (this.contentService.hasLoadedData() && !this.town()) {
        setGamePlayView('world');
      }
    });
  }
}
