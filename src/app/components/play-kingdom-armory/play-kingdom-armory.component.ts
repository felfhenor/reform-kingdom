import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { ArmoryItemSlotComponent } from '@components/armory-item-slot/armory-item-slot.component';
import { CurrencyCostComponent } from '@components/currency-cost/currency-cost';
import { PagedGridPageComponent } from '@components/paged-grid-page/paged-grid-page.component';
import {
  equipmentSellValue,
  filterArmoryEntries,
  getArmoryEntries,
  goldCoinId,
  sellEquipmentItems,
} from '@helpers';
import type { EquipmentItemId } from '@interfaces';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';
import { sum } from 'es-toolkit/compat';

@Component({
  selector: 'app-play-kingdom-armory',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ArmoryItemSlotComponent,
    CurrencyCostComponent,
    PagedGridPageComponent,
    SweetAlert2Module,
  ],
  templateUrl: './play-kingdom-armory.component.html',
  styleUrl: './play-kingdom-armory.component.scss',
})
export class PlayKingdomArmoryComponent {
  public entries = computed(() => getArmoryEntries());
  public filterFn = filterArmoryEntries;

  public goldCoinItemId = goldCoinId();

  public sellMode = signal(false);
  public selectedIds = signal<Set<EquipmentItemId>>(new Set());

  public selectedCount = computed(() => this.selectedIds().size);

  public selectedGoldTotal = computed(() => {
    const selected = this.selectedIds();
    return sum(
      this.entries()
        .filter((entry) => selected.has(entry.item.id))
        .map((entry) => equipmentSellValue(entry)),
    );
  });

  public toggleSellMode(): void {
    if (this.sellMode()) {
      this.exitSellMode();
      return;
    }
    this.sellMode.set(true);
  }

  public toggleSelected(itemId: EquipmentItemId): void {
    this.selectedIds.update((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

  public confirmSell(): void {
    sellEquipmentItems([...this.selectedIds()]);
    this.exitSellMode();
  }

  private exitSellMode(): void {
    this.sellMode.set(false);
    this.selectedIds.set(new Set());
  }
}
