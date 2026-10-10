import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { ModalComponent } from '@components/modal/modal.component';
import { RowElementChargesComponent } from '@components/row-element-charges/row-element-charges.component';
import { SlotRarityOutlineComponent } from '@components/slot-rarity-outline/slot-rarity-outline.component';
import { TooltipSkillPreviewComponent } from '@components/tooltip-skill-preview/tooltip-skill-preview.component';
import { ListRowDirective } from '@directives/list-row.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { combatantFromCharacter } from '@helpers/combat/combat-create';
import { heroBurstSkillsModalCharacterId } from '@helpers/engine/ui';
import { burstSkillSet, burstSkillUnset } from '@helpers/hero/burst-skill.ui';
import {
  characterBurstSkillOptions,
  characterChosenBurstSkills,
} from '@helpers/hero/job';
import { equippedItemTypes } from '@helpers/item/equipment';
import { worldPartyState } from '@helpers/state-game';
import type { EquipmentSkillContent } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-modal-hero-burst-skills',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BlankSlateComponent,
    DecimalPipe,
    ListRowDirective,
    ModalComponent,
    RowElementChargesComponent,
    SFXDirective,
    SlotRarityOutlineComponent,
    TippyDirective,
    TooltipSkillPreviewComponent,
  ],
  templateUrl: './modal-hero-burst-skills.component.html',
})
export class ModalHeroBurstSkillsComponent {
  public character = computed(() =>
    worldPartyState().find((c) => c.id === heroBurstSkillsModalCharacterId()),
  );

  public options = computed<EquipmentSkillContent[]>(() => {
    const character = this.character();
    return character ? characterBurstSkillOptions(character) : [];
  });

  public chosenId = computed(() => {
    const character = this.character();
    return character ? characterChosenBurstSkills(character)[0]?.id : undefined;
  });

  public heroCombatant = computed(() => {
    const character = this.character();
    return character ? combatantFromCharacter(character) : undefined;
  });

  public equippedWeaponTypes = computed(() => {
    const character = this.character();
    return character ? equippedItemTypes(character.equipment) : [];
  });

  public choose(skill: EquipmentSkillContent): void {
    const character = this.character();
    if (!character || skill.id === this.chosenId()) return;

    burstSkillSet(character.id, character.jobId, skill);
  }

  public unset(): void {
    const character = this.character();
    if (!character) return;

    burstSkillUnset(character.id, character.jobId);
  }
}
