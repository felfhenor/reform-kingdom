import type { AnimationCallbackEvent } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { DetailItemPreviewComponent } from '@components/detail-item-preview/detail-item-preview.component';
import { ModalComponent } from '@components/modal/modal.component';
import { SlotRarityOutlineComponent } from '@components/slot-rarity-outline/slot-rarity-outline.component';
import { ListReflowDirective } from '@directives/list-reflow.directive';
import { ModalCloseDirective } from '@directives/modal-close.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { allEquipmentItemTypes } from '@helpers/item/equipment-types';
import { itemPreviewDisplay } from '@helpers/item/item-preview';
import {
  lootFilterAddException,
  lootFilterExceptionOptions,
  lootFilterExceptions,
  lootFilterRemoveException,
  lootFilterSetEquipmentTypeKept,
  lootFilterSetMinimumItemLevel,
  lootFilterSetRarityKept,
  lootFilterSetSourceSells,
  lootFilterSettings,
  lootFilterSummary,
} from '@helpers/kingdom/loot-filter.ui';
import type {
  DropRarity,
  EquipmentId,
  EquipmentItemType,
  LootFilterSettings,
  LootSource,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { AnimationService } from '@services/animation.service';

const SOURCES: LootSource[] = ['Combat', 'Crafting'];

const RARITIES: DropRarity[] = [
  'Common',
  'Uncommon',
  'Rare',
  'Mystical',
  'Legendary',
];

@Component({
  selector: 'app-modal-loot-filters',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ModalComponent,
    ModalCloseDirective,
    SFXDirective,
    FormsModule,
    NgSelectComponent,
    NgOptionTemplateDirective,
    NgLabelTemplateDirective,
    AtlasImageComponent,
    SlotRarityOutlineComponent,
    DetailItemPreviewComponent,
    TippyDirective,
    ListReflowDirective,
  ],
  templateUrl: './modal-loot-filters.component.html',
})
export class ModalLootFiltersComponent {
  public readonly sources = SOURCES;
  public readonly rarities = RARITIES;
  public readonly equipmentTypes = allEquipmentItemTypes();

  public filters = computed<LootFilterSettings>(() => lootFilterSettings());
  public summary = computed(() => lootFilterSummary(this.filters()));

  public exceptionOptions = computed(() =>
    lootFilterExceptionOptions(this.filters()),
  );
  public exceptions = computed(() =>
    lootFilterExceptions(this.filters()).map((content) => ({
      content,
      display: itemPreviewDisplay('equipment', content),
    })),
  );
  public selectedExceptionId = signal<EquipmentId | undefined>(undefined);

  public readonly removeException = lootFilterRemoveException;

  private anim = inject(AnimationService);

  public toggleSource(source: LootSource): void {
    lootFilterSetSourceSells(source, !this.filters().sellFromSources[source]);
  }

  public toggleRarity(rarity: DropRarity): void {
    lootFilterSetRarityKept(rarity, !this.filters().keepRarities[rarity]);
  }

  public toggleType(type: EquipmentItemType): void {
    lootFilterSetEquipmentTypeKept(
      type,
      !this.filters().keepEquipmentTypes[type],
    );
  }

  public setMinimumItemLevel(value: number): void {
    if (Number.isNaN(value)) return;
    lootFilterSetMinimumItemLevel(value);
  }

  public addException(): void {
    const equipmentId = this.selectedExceptionId();
    if (!equipmentId) return;

    lootFilterAddException(equipmentId);
    this.selectedExceptionId.set(undefined);
  }

  public onEnter(event: AnimationCallbackEvent): void {
    this.anim.fadeIn(event.target, 200);
  }

  public onLeave(event: AnimationCallbackEvent): void {
    this.anim
      .fadeOut(event.target, 150)
      .then(() => event.animationComplete())
      .catch(() => event.animationComplete());
  }
}
