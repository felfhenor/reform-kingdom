import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { ModalComponent } from '@components/modal/modal.component';
import { activeTownNode } from '@helpers/engine/ui';
import { townShopItemCap } from '@helpers/town/shop/town-shop-access';
import { townStock, townStockDisplay } from '@helpers/town/shop/town-stock';
import { worldNodeTown } from '@helpers/world-node/world-nodes';
import type { TownModalTab, TownStockEntry } from '@interfaces';

@Component({
  selector: 'app-modal-town',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, DecimalPipe],
  templateUrl: './modal-town.component.html',
})
export class ModalTownComponent {
  public entry = computed(() => activeTownNode());

  public town = computed(() => {
    const entry = this.entry();
    return entry ? worldNodeTown(entry) : undefined;
  });

  public currentTab = signal<TownModalTab>('shop');

  public stock = computed(() => {
    const town = this.town();
    return town ? townStock(town.id) : [];
  });

  public stockCap = computed(() => {
    const town = this.town();
    return town ? townShopItemCap(town.id) : 0;
  });

  public stockEntryName(entry: TownStockEntry): string {
    return townStockDisplay(entry)?.name ?? 'Unknown Item';
  }
}
