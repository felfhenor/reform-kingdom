import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { ButtonGlowComponent } from '@components/button-glow/button-glow.component';
import { SlotButtonContainerComponent } from '@components/slot-button-container/slot-button-container.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { SlotRarityOutlineComponent } from '@components/slot-rarity-outline/slot-rarity-outline.component';
import { TooltipSkillPreviewComponent } from '@components/tooltip-skill-preview/tooltip-skill-preview.component';
import { SFXDirective } from '@directives/sfx.directive';
import { TutorialTargetDirective } from '@directives/tutorial-target.directive';
import { combatantFromCharacter } from '@helpers/combat/combat-create';
import { getEntry } from '@helpers/content/content';
import { heroBurstSkillsModalOpen } from '@helpers/engine/ui';
import {
  characterBurstSkillOptions,
  characterChosenBurstSkills,
  characterNormalSkills,
} from '@helpers/hero/job';
import { canModifyEquipment, equippedItemTypes } from '@helpers/item/equipment';
import type {
  Character,
  EquipmentItemType,
  EquipmentSkillContent,
  JobContent,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-panel-hero-equipment-skills',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BlankSlateComponent,
    TippyDirective,
    SlotRarityOutlineComponent,
    TooltipSkillPreviewComponent,
    ButtonGlowComponent,
    SlotIconBlankComponent,
    SFXDirective,
    TutorialTargetDirective,
    DecimalPipe,
    SlotButtonContainerComponent,
  ],
  host: {
    class: 'flex flex-col min-h-0 pb-8',
  },
  templateUrl: './panel-hero-equipment-skills.component.html',
  styleUrl: './panel-hero-equipment-skills.component.scss',
})
export class PanelHeroEquipmentSkillsComponent {
  public character = input.required<Character>();

  public job = computed<JobContent | undefined>(() =>
    getEntry<JobContent>(this.character().jobId),
  );

  public heroSkills = computed<EquipmentSkillContent[]>(() =>
    characterNormalSkills(this.character()),
  );

  public hasBurstOptions = computed(
    () => characterBurstSkillOptions(this.character()).length > 0,
  );

  public chosenBurstSkill = computed<EquipmentSkillContent | undefined>(
    () => characterChosenBurstSkills(this.character())[0],
  );

  public heroCombatant = computed(() =>
    combatantFromCharacter(this.character()),
  );

  public equippedWeaponTypes = computed<EquipmentItemType[]>(() =>
    equippedItemTypes(this.character().equipment),
  );

  public burstModifiable = computed(() => canModifyEquipment());

  public openBurstPicker(): void {
    heroBurstSkillsModalOpen(this.character().id);
  }
}
