import { TPipe } from '@pipes/t.pipe';
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
import { SFXDirective } from '@directives/sfx.directive';
import { FFSelectDirective } from '@ff/controls/ff-select.directive';
import { FFStepperDirective } from '@ff/controls/ff-stepper.directive';
import { contentSearchFn } from '@helpers/i18n/i18n-content.ui';
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
import { globalEffectSumsState } from '@helpers/state-game';
import type {
  DropRarity,
  EquipmentId,
  EquipmentItemType,
  LootFilterSettings,
  LootSource,
} from '@interfaces';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { TippyDirective } from '@ngneat/helipopper';
import { ContentNamePipe } from '@pipes/content-name.pipe';
import { AnimationService } from '@services/animation.service';

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
    TPipe,
    ContentNamePipe,
    FFStepperDirective,
    FFSelectDirective,
    ModalComponent,
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
  public readonly contentSearch = contentSearchFn;
  private anim = inject(AnimationService);

  public readonly rarities = RARITIES;
  public readonly equipmentTypes = allEquipmentItemTypes();

  public selectedExceptionId = signal<EquipmentId | undefined>(undefined);

  public readonly removeException = lootFilterRemoveException;

  public filters = computed<LootFilterSettings>(() => lootFilterSettings());
  public summary = computed(() => lootFilterSummary(this.filters()));

  public canCraft = computed(
    () => !globalEffectSumsState().tradeskillsDisabled,
  );
  public sources = computed<LootSource[]>(() => {
    if (!this.canCraft()) return ['Combat'];

    return ['Combat', 'Crafting'];
  });

  public exceptionOptions = computed(() =>
    lootFilterExceptionOptions(this.filters()),
  );
  public exceptions = computed(() =>
    lootFilterExceptions(this.filters()).map((content) => ({
      content,
      display: itemPreviewDisplay('equipment', content),
    })),
  );

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
