import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { AtlasAnimationComponent } from '@components/atlas-animation/atlas-animation.component';
import { ModalComponent } from '@components/modal/modal.component';
import { SpriteNodeComponent } from '@components/sprite-node/sprite-node.component';
import { activeTownNode } from '@helpers/engine/ui';
import { townShopItemCap } from '@helpers/town/shop/town-shop-access';
import { townStock, townStockDisplay } from '@helpers/town/shop/town-stock';
import {
  townWorkerRosterEntries,
  townWorkerStatusDisplay,
} from '@helpers/town/worker/town-worker-roster';
import { worldNodeTown } from '@helpers/world-node/world-nodes';
import type {
  TownModalTab,
  TownStockEntry,
  TownWorkerRosterEntry,
  TownWorkerStatusDisplay,
} from '@interfaces';

@Component({
  selector: 'app-modal-town',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ModalComponent,
    DecimalPipe,
    AtlasAnimationComponent,
    SpriteNodeComponent,
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

  public workers = computed(() => {
    const town = this.town();
    return town ? townWorkerRosterEntries(town.id) : [];
  });

  public workerStatusDisplay(
    entry: TownWorkerRosterEntry,
  ): TownWorkerStatusDisplay {
    const town = this.town();
    return town
      ? townWorkerStatusDisplay(town, entry.status)
      : { label: '', locationEntry: undefined };
  }
}
