import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { BarTownReputationComponent } from '@components/bar-town-reputation/bar-town-reputation.component';
import { ButtonTownHomeComponent } from '@components/button-town-home/button-town-home.component';
import { ModalComponent } from '@components/modal/modal.component';
import { PanelTownCraftingComponent } from '@components/panel-town-crafting/panel-town-crafting.component';
import { PanelTownQuestsComponent } from '@components/panel-town-quests/panel-town-quests.component';
import { PanelTownRaidComponent } from '@components/panel-town-raid/panel-town-raid.component';
import { PanelTownShopComponent } from '@components/panel-town-shop/panel-town-shop.component';
import { PanelTownWorkersComponent } from '@components/panel-town-workers/panel-town-workers.component';
import { formatDuration, timerTicksElapsed } from '@helpers/engine/timer';
import { activeTownNode } from '@helpers/engine/ui';
import { townRaidTelegraph } from '@helpers/town/raid/town-raid-state';
import { townStock } from '@helpers/town/shop/town-stock';
import { townShopItemCap } from '@helpers/town/shop/town-shop-access';
import { worldNodeTown } from '@helpers/world-node/world-nodes';
import type { TownModalTab } from '@interfaces';

@Component({
  selector: 'app-modal-town',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ModalComponent,
    DecimalPipe,
    BarTownReputationComponent,
    ButtonTownHomeComponent,
    PanelTownShopComponent,
    PanelTownCraftingComponent,
    PanelTownWorkersComponent,
    PanelTownQuestsComponent,
    PanelTownRaidComponent,
  ],
  templateUrl: './modal-town.component.html',
})
export class ModalTownComponent {
  public entry = computed(() => activeTownNode());

  public town = computed(() => {
    const entry = this.entry();
    return entry ? worldNodeTown(entry) : undefined;
  });

  public currentTab = signal<TownModalTab>('shop');

  // Badge counts only - the full stock/telegraph data lives in the shop/raid tab panels themselves.
  public shopStockCount = computed(() => {
    const town = this.town();
    return town ? townStock(town.id).length : 0;
  });

  public stockCap = computed(() => {
    const town = this.town();
    return town ? townShopItemCap(town.id) : 0;
  });

  public raidCountdown = computed(() => {
    const town = this.town();
    const telegraph = town ? townRaidTelegraph(town.id) : undefined;
    if (!telegraph) return undefined;

    return formatDuration(
      telegraph.engageWindowExpiresAtTick - timerTicksElapsed(),
    );
  });
}
