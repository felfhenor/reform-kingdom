import { DecimalPipe, formatNumber } from '@angular/common';
import type { AnimationCallbackEvent } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CurrencyCostComponent } from '@components/currency-cost/currency-cost';
import { ModalLootFiltersComponent } from '@components/modal-loot-filters/modal-loot-filters.component';
import { PagePagedGridComponent } from '@components/page-paged-grid/page-paged-grid.component';
import { SlotArmoryItemComponent } from '@components/slot-armory-item/slot-armory-item.component';
import { SlotButtonContainerComponent } from '@components/slot-button-container/slot-button-container.component';
import { SFXDirective } from '@directives/sfx.directive';
import { modalOpen } from '@helpers/engine/modal-stack';
import { notifySuccess, notifyWarning } from '@helpers/engine/notify';
import { equipArmoryItems } from '@helpers/hero/character-equipment.ui';
import { canModifyEquipment } from '@helpers/item/equipment';
import { goldCoinId } from '@helpers/item/materials';
import {
  armoryCap,
  armoryGet,
  equipmentSellValue,
  getArmoryEntries,
} from '@helpers/kingdom/armory';
import {
  armoryBadgeClass,
  filterArmoryEntries,
  sellEquipmentItems,
} from '@helpers/kingdom/armory.ui';
import {
  isLootFilterActive,
  lootFilterSettings,
} from '@helpers/kingdom/loot-filter.ui';
import type { EquipmentArmoryEntry, EquipmentItemId } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import { AnimationService } from '@services/animation.service';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';
import { sum } from 'es-toolkit/compat';

@Component({
  selector: 'app-play-kingdom-armory',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SlotArmoryItemComponent,
    SlotButtonContainerComponent,
    CurrencyCostComponent,
    ModalLootFiltersComponent,
    PagePagedGridComponent,
    SweetAlert2Module,
    DecimalPipe,
    SFXDirective,
    TippyDirective,
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

  public armorySize = computed(() => armoryGet().length);
  public armoryCapValue = computed(() => armoryCap());
  public badgeColor = computed(() =>
    armoryBadgeClass(this.armorySize(), this.armoryCapValue()),
  );

  public lootFilterActive = computed(() =>
    isLootFilterActive(lootFilterSettings()),
  );

  private anim = inject(AnimationService);
  private locale = inject(LOCALE_ID);

  public equipmentModifiable = computed(() => canModifyEquipment());

  public openLootFilters(): void {
    modalOpen('loot-filters');
  }

  public equipCandidateIds = computed(() => {
    const grid = this.grid();
    if (!grid?.searchText().trim()) return [];
    return grid.filteredEntries().map((entry) => entry.item.id);
  });

  public equipping = signal(false);

  public async equipFiltered(): Promise<void> {
    this.equipping.set(true);
    const count = await equipArmoryItems(this.equipCandidateIds()).finally(() =>
      this.equipping.set(false),
    );
    if (count === 0) {
      notifyWarning('No hero could equip any of those items.');
      return;
    }
    const label = formatNumber(count, this.locale);
    notifySuccess(`Equipped ${label} ${count === 1 ? 'item' : 'items'}.`);
  }

  public onButtonEnter(event: AnimationCallbackEvent): void {
    this.anim.fadeIn(event.target);
  }

  public onButtonLeave(event: AnimationCallbackEvent): void {
    this.anim
      .fadeOut(event.target)
      .then(() => event.animationComplete())
      .catch(() => event.animationComplete());
  }

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
    void sellEquipmentItems([...this.selectedIds()]);
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
