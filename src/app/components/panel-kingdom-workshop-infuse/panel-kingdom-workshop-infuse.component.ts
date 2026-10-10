import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { CurrencyCostComponent } from '@components/currency-cost/currency-cost';
import { DetailItemPreviewComponent } from '@components/detail-item-preview/detail-item-preview.component';
import { RowCurrencyCostComponent } from '@components/row-currency-cost/row-currency-cost.component';
import { RowGatherYieldBonusesComponent } from '@components/row-gather-yield-bonuses/row-gather-yield-bonuses.component';
import { RowInfusedMaterialsComponent } from '@components/row-infused-materials/row-infused-materials.component';
import { RowSkillStatBonusesComponent } from '@components/row-skill-stat-bonuses/row-skill-stat-bonuses.component';
import { RowStatSummaryComponent } from '@components/row-stat-summary/row-stat-summary.component';
import { SlotButtonContainerComponent } from '@components/slot-button-container/slot-button-container.component';
import { SlotRarityOutlineComponent } from '@components/slot-rarity-outline/slot-rarity-outline.component';
import { ListReflowDirective } from '@directives/list-reflow.directive';
import { ListRowDirective } from '@directives/list-row.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { TeleportToDirective } from '@directives/teleport.to.directive';
import { getEntry } from '@helpers/content/content';
import { equipmentInfuse } from '@helpers/hero/character-equipment';
import {
  canInfuseEquipmentItem,
  equipmentItemSlotCount,
  infusionMaterialCost,
  isInfusionMaterial,
} from '@helpers/item/infusion';
import {
  resolveGatherYieldBonusDisplay,
  resolveSkillStatBonusDisplay,
} from '@helpers/item/item-preview';
import { goldCoinId } from '@helpers/item/materials';
import { getStorageMaterials } from '@helpers/kingdom/storage.ui';
import type {
  EquipmentItem,
  EquipmentItemId,
  ItemContent,
  ItemId,
  ItemPreviewDisplay,
  StorageMaterialEntry,
} from '@interfaces';
import { AnimationService } from '@services/animation.service';
import type { SwalComponent } from '@sweetalert2/ngx-sweetalert2';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';

@Component({
  selector: 'app-panel-kingdom-workshop-infuse',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BlankSlateComponent,
    ListReflowDirective,
    SlotButtonContainerComponent,
    CurrencyCostComponent,
    RowInfusedMaterialsComponent,
    DetailItemPreviewComponent,
    RowStatSummaryComponent,
    RowGatherYieldBonusesComponent,
    RowSkillStatBonusesComponent,
    SweetAlert2Module,
    SlotRarityOutlineComponent,
    ListRowDirective,
    SFXDirective,
    TeleportToDirective,
    RowCurrencyCostComponent,
  ],
  host: { class: 'contents' },
  templateUrl: './panel-kingdom-workshop-infuse.component.html',
})
export class PanelKingdomWorkshopInfuseComponent {
  private anim = inject(AnimationService);
  private materialsRowEl = viewChild(RowInfusedMaterialsComponent, {
    read: ElementRef,
  });

  public item = input.required<EquipmentItem>();
  public display = input.required<ItemPreviewDisplay>();
  public modifiable = input.required<boolean>();
  public actionOutlet = input.required<string>();

  public goldCoinItemId = goldCoinId();

  public selectedSlotIndex = linkedSignal<EquipmentItemId, number | undefined>({
    source: () => this.item().id,
    computation: () => undefined,
  });

  public slotCount = computed(() => equipmentItemSlotCount(this.item()));

  public infusionMaterials = computed<StorageMaterialEntry[]>(() =>
    getStorageMaterials().filter((entry) => isInfusionMaterial(entry.item)),
  );

  public selectedInfusion = signal<StorageMaterialEntry | undefined>(undefined);

  public selectedInfusionCost = computed(() => {
    const selected = this.selectedInfusion();

    if (!selected) return [];

    return [
      { itemId: goldCoinId(), required: this.materialCost(selected.item.id) },
    ];
  });

  public materialCost(itemId: ItemId): number {
    return infusionMaterialCost(itemId);
  }

  public materialSkillStatBonuses(material: ItemContent) {
    return resolveSkillStatBonusDisplay(
      material.infusionSkillStatBonuses ?? [],
    );
  }

  // Raw, uncombined - just this one material's own infusion grant, same treatment as its infusionStats/infusionDebuffResistances/infusionCombatStats above.
  public materialGatherYieldBonuses(material: ItemContent) {
    return resolveGatherYieldBonusDisplay(
      material.infusionGatherYieldBonuses ?? [],
    );
  }

  // Never disabled for "slot already infused" - overwriting is allowed.
  // Only disabled when the player can't actually afford/supply it.
  public canAffordMaterial(itemId: ItemId): boolean {
    const slotIndex = this.selectedSlotIndex();
    if (slotIndex === undefined) return false;

    return canInfuseEquipmentItem(this.item(), slotIndex, itemId);
  }

  public selectSlot(slotIndex: number): void {
    this.selectedSlotIndex.set(slotIndex);
  }

  private infuseSwal = viewChild<SwalComponent>('infuseSwal');
  private pendingMaterialId = signal<ItemId | undefined>(undefined);
  private pendingSourceEl?: HTMLElement;

  private isOverwritingSelectedSlot(): boolean {
    const slotIndex = this.selectedSlotIndex();
    if (slotIndex === undefined) return false;

    return !!this.item().infusedItemIds[slotIndex];
  }

  private buildInfuseConfirmText(materialItemId: ItemId): string {
    const material = getEntry<ItemContent>(materialItemId);
    const cost = this.materialCost(materialItemId);
    const base = `Infuse ${material?.name ?? 'this material'} for ${cost}g?`;

    return this.isOverwritingSelectedSlot()
      ? `${base} This slot is already infused - doing this will replace it, and the existing items will not be refunded.`
      : base;
  }

  public requestInfuse(
    entry: StorageMaterialEntry | undefined,
    event: Event,
    skipConfirm = false,
  ): void {
    if (!entry) return;

    const materialItemId = entry.item.id;
    this.pendingMaterialId.set(materialItemId);
    this.pendingSourceEl =
      (event.currentTarget as HTMLElement).querySelector('img') ?? undefined;
    if (skipConfirm) {
      this.confirmInfuse();
      return;
    }

    const swal = this.infuseSwal();
    if (!swal) return;

    // `swalOptions` is a plain setter, unlike `[text]` which needs an Angular flush - too late for a synchronous `.fire()` right after.
    swal.swalOptions = { text: this.buildInfuseConfirmText(materialItemId) };
    swal.fire();
  }

  public confirmInfuse(): void {
    const slotIndex = this.selectedSlotIndex();
    const materialItemId = this.pendingMaterialId();
    if (slotIndex === undefined || !materialItemId) return;

    const sourceEl = this.pendingSourceEl;
    const targetEl = this.materialsRowEl()?.nativeElement.querySelector(
      `[data-slot-index="${slotIndex}"]`,
    );

    equipmentInfuse(this.item().id, slotIndex, materialItemId);
    this.pendingMaterialId.set(undefined);
    this.pendingSourceEl = undefined;

    if (sourceEl && targetEl) {
      this.anim.flyTo(sourceEl, targetEl);
    }
  }
}
