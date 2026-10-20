import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
  viewChild,
} from '@angular/core';
import { IconSpecComponent } from '@components/icon-spec/icon-spec.component';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { ButtonKingdomBackComponent } from '@components/button-kingdom-back/button-kingdom-back.component';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { IconComponent } from '@components/icon/icon.component';
import { IconItemPreviewComponent } from '@components/icon-item-preview/icon-item-preview.component';
import { RowCombatOrderClauseComponent } from '@components/row-combat-order-clause/row-combat-order-clause.component';
import { RowEquipmentItemSummaryComponent } from '@components/row-equipment-item-summary/row-equipment-item-summary.component';
import { RowHeroSummaryComponent } from '@components/row-hero-summary/row-hero-summary.component';
import { SlotButtonContainerComponent } from '@components/slot-button-container/slot-button-container.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { SlotRarityOutlineComponent } from '@components/slot-rarity-outline/slot-rarity-outline.component';
import { ListReflowDirective } from '@directives/list-reflow.directive';
import { ListRowDirective } from '@directives/list-row.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { COMBAT_ORDER_ALWAYS_RANDOM_CLAUSE } from '@helpers/combat/combat-order';
import { REGALIA_MAX_PER_JOB, REGALIA_NAME_MAX_LENGTH } from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import {
  heroesSelectCharacter,
  heroesSelectedCharacterId,
  heroesSubviewClear,
} from '@helpers/engine/ui';
import {
  characterJobRegalias,
  regaliaAppliedCharacter,
  regaliaMatchesCharacter,
  regaliaMissingItems,
} from '@helpers/hero/regalia';
import {
  regaliaCreate,
  regaliaEquip,
  regaliaRemove,
  regaliaRename,
} from '@helpers/hero/regalia.ui';
import { canModifyEquipment, equippedItems } from '@helpers/item/equipment';
import {
  armoryState,
  regaliasState,
  worldPartyState,
} from '@helpers/state-game';
import { characterJobLevel } from '@helpers/hero/job';
import { skillTreeBuildSummary } from '@helpers/hero/skill-tree-layout.ui';
import { regaliaEquipLosesLiveTree } from '@helpers/hero/skill-tree.ui';
import type {
  CharacterId,
  EquipmentItem,
  EquipmentItemId,
  EquipmentSkillContent,
  Regalia,
  RegaliaId,
  RegaliaMissingReason,
  JobContent,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import type { SwalComponent } from '@sweetalert2/ngx-sweetalert2';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';

@Component({
  selector: 'app-play-heroes-regalia',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconSpecComponent,
    BlankSlateComponent,
    ButtonKingdomBackComponent,
    CardPageComponent,
    DecimalPipe,
    IconComponent,
    IconItemPreviewComponent,
    ListReflowDirective,
    ListRowDirective,
    RowCombatOrderClauseComponent,
    RowEquipmentItemSummaryComponent,
    RowHeroSummaryComponent,
    SFXDirective,
    SlotButtonContainerComponent,
    SlotIconBlankComponent,
    SlotRarityOutlineComponent,
    SweetAlert2Module,
    TippyDirective,
  ],
  templateUrl: './play-heroes-regalia.component.html',
})
export class PlayHeroesRegaliaComponent {
  private renameSwal = viewChild<SwalComponent>('renameSwal');
  private equipSwal = viewChild<SwalComponent>('equipSwal');

  public readonly maxRegalias = REGALIA_MAX_PER_JOB;
  public readonly alwaysRandomClause = COMBAT_ORDER_ALWAYS_RANDOM_CLAUSE;
  public readonly back = heroesSubviewClear;

  public party = computed(() => worldPartyState());

  public selectedCharacter = computed(
    () =>
      this.party().find((c) => c.id === heroesSelectedCharacterId()) ??
      this.party()[0],
  );

  public regalias = computed(() => {
    const character = this.selectedCharacter();
    return character
      ? characterJobRegalias(
          regaliasState().entries,
          character.id,
          character.jobId,
        )
      : [];
  });

  public currentRegaliaId = computed(() => {
    const character = this.selectedCharacter();
    return character?.currentRegaliaIds[character.jobId];
  });

  private explicitRegaliaId = signal<RegaliaId | undefined>(undefined);

  // Falls back to the hero's current regalia, so opening the page lands on it.
  public selectedRegalia = computed(() => {
    const regalias = this.regalias();
    return (
      regalias.find((r) => r.id === this.explicitRegaliaId()) ??
      regalias.find((r) => r.id === this.currentRegaliaId())
    );
  });

  private availableItems = computed(() => [
    ...regaliasState().vault,
    ...armoryState(),
  ]);

  public missingByRegalia = computed(() => {
    const character = this.selectedCharacter();
    const available = this.availableItems();
    return new Map(
      this.regalias().map((regalia) => [
        regalia.id,
        character ? regaliaMissingItems(regalia, character, available) : [],
      ]),
    );
  });

  public selectedMissingReasons = computed(() => {
    const regalia = this.selectedRegalia();
    const missing = regalia ? this.missingByRegalia().get(regalia.id) : [];
    return new Map<EquipmentItemId, RegaliaMissingReason>(
      (missing ?? []).map((entry) => [entry.id, entry.reason]),
    );
  });

  // Includes other heroes' gear so an item they're wearing still shows its name.
  public ownedItemsById = computed(
    () =>
      new Map<EquipmentItemId, EquipmentItem>(
        [
          ...this.party().flatMap((c) => equippedItems(c.equipment)),
          ...this.availableItems(),
        ].map((item) => [item.id, item]),
      ),
  );

  public selectedRegaliaCharacter = computed(() => {
    const character = this.selectedCharacter();
    const regalia = this.selectedRegalia();
    return character && regalia
      ? regaliaAppliedCharacter(regalia, character, this.availableItems())
      : undefined;
  });

  public selectedBurstSkill = computed(() => {
    const skillId = this.selectedRegalia()?.burstSkillIds[0];
    return skillId ? getEntry<EquipmentSkillContent>(skillId) : undefined;
  });

  public selectedMatches = computed(() => {
    const character = this.selectedCharacter();
    const regalia = this.selectedRegalia();
    return (
      !!character && !!regalia && regaliaMatchesCharacter(regalia, character)
    );
  });

  public equipmentModifiable = computed(() => canModifyEquipment());

  public selectCharacter(characterId: CharacterId): void {
    heroesSelectCharacter(characterId);
    this.explicitRegaliaId.set(undefined);
  }

  public selectRegalia(regalia: Regalia): void {
    this.explicitRegaliaId.set(regalia.id);
  }

  public async create(): Promise<void> {
    const character = this.selectedCharacter();
    if (!character) return;

    const id = await regaliaCreate(character.id);
    if (id) this.explicitRegaliaId.set(id);
  }

  public async equip(): Promise<void> {
    const character = this.selectedCharacter();
    const regalia = this.selectedRegalia();
    if (!character || !regalia) return;

    const swal = this.equipSwal();
    if (
      swal &&
      regaliaEquipLosesLiveTree(regaliasState().entries, character, regalia)
    ) {
      swal.swalOptions = {
        text: `${character.name}'s current skill tree isn't saved in any regalia. Equipping "${regalia.name}" replaces it, and rebuilding it later would cost a Memory Flux.`,
      };
      const result = await swal.fire();
      if (!result.isConfirmed) return;
    }

    await regaliaEquip(character.id, regalia.id);
  }

  public treeSummary = computed(() => {
    const character = this.selectedCharacter();
    const regalia = this.selectedRegalia();
    const job = regalia ? getEntry<JobContent>(regalia.jobId) : undefined;
    return character && regalia && job
      ? skillTreeBuildSummary(
          regalia.skillTreeNodeIds,
          job,
          characterJobLevel(character, regalia.jobId),
        )
      : undefined;
  });

  public async rename(): Promise<void> {
    const regalia = this.selectedRegalia();
    const swal = this.renameSwal();
    if (!regalia || !swal) return;

    swal.swalOptions = {
      inputValue: regalia.name,
      inputAttributes: { maxlength: `${REGALIA_NAME_MAX_LENGTH}` },
    };
    const result = await swal.fire();
    if (result.isConfirmed) {
      await regaliaRename(regalia.id, String(result.value ?? ''));
    }
  }

  public remove(): void {
    const regalia = this.selectedRegalia();
    if (regalia) void regaliaRemove(regalia.id);
  }

  public missingTooltip(reason: RegaliaMissingReason | undefined): string {
    if (reason === 'gone') {
      return 'This item is no longer available. It may have been sold or otherwise destroyed.';
    }
    if (reason === 'unequippable') {
      return 'This hero can no longer equip this item.';
    }
    if (reason === 'displaced') {
      return 'Conflicts with another item in this regalia.';
    }
    return '';
  }
}
