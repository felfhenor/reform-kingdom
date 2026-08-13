import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
  viewChild,
} from '@angular/core';
import { SlotArmoryItemComponent } from '@components/slot-armory-item/slot-armory-item.component';
import { CurrencyCostComponent } from '@components/currency-cost/currency-cost';
import { PagePagedGridComponent } from '@components/page-paged-grid/page-paged-grid.component';
import {
  equipmentSellValue,
  filterArmoryEntries,
  getArmoryEntries,
  goldCoinId,
  sellEquipmentItems,
} from '@helpers';
import type { EquipmentArmoryEntry, EquipmentItemId } from '@interfaces';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';
import { sum } from 'es-toolkit/compat';

@Component({
  selector: 'app-play-kingdom-armory',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SlotArmoryItemComponent,
    CurrencyCostComponent,
    PagePagedGridComponent,
    SweetAlert2Module,
    DecimalPipe,
  ],
  templateUrl: './play-kingdom-armory.component.html',
  styleUrl: './play-kingdom-armory.component.scss',
})
export class PlayKingdomArmoryComponent {
  private grid =
    viewChild<PagePagedGridComponent<EquipmentArmoryEntry>>('grid');

  public entries = computed(() => getArmoryEntries());
  public filterFn = filterArmoryEntries;

  public goldCoinItemId = goldCoinId();

  public sellMode = signal(false);
  public selectedIds = signal<Set<EquipmentItemId>>(new Set());
  private lastSelectedId = signal<EquipmentItemId | undefined>(undefined);

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

  public toggleSelected(itemId: EquipmentItemId, event: MouseEvent): void {
    const anchorId = this.lastSelectedId();

    if (event.shiftKey && anchorId !== undefined) {
      this.selectRange(anchorId, itemId);
    } else {
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

    this.lastSelectedId.set(itemId);
  }

  public confirmSell(): void {
    sellEquipmentItems([...this.selectedIds()]);
    this.exitSellMode();
  }

  private exitSellMode(): void {
    this.sellMode.set(false);
    this.selectedIds.set(new Set());
    this.lastSelectedId.set(undefined);
  }

  private selectRange(fromId: EquipmentItemId, toId: EquipmentItemId): void {
    const visible = this.grid()?.pagedEntries() ?? [];
    const fromIndex = visible.findIndex((entry) => entry.item.id === fromId);
    const toIndex = visible.findIndex((entry) => entry.item.id === toId);
    if (fromIndex === -1 || toIndex === -1) return;

    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);
    const rangeIds = visible
      .slice(start, end + 1)
      .map((entry) => entry.item.id);

    this.selectedIds.update((current) => {
      const next = new Set(current);
      rangeIds.forEach((id) => next.add(id));
      return next;
    });
  }
}
