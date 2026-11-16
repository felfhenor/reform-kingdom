import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { RowElementChargesComponent } from '@components/row-element-charges/row-element-charges.component';
import { SlotRarityOutlineComponent } from '@components/slot-rarity-outline/slot-rarity-outline.component';
import { TooltipSkillPreviewComponent } from '@components/tooltip-skill-preview/tooltip-skill-preview.component';
import { ListRowDirective } from '@directives/list-row.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { combatantFromCharacter } from '@helpers/combat/combat-create';
import {
  characterBurstSkillOptions,
  characterChosenBurstSkills,
} from '@helpers/hero/job';
import { skillEpCost } from '@helpers/hero/skill';
import { equippedItemTypes } from '@helpers/item/equipment';
import type { Character, EquipmentSkillContent } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-panel-hero-burst-skills',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-2' },
  imports: [
    BlankSlateComponent,
    DecimalPipe,
    ListRowDirective,
    RowElementChargesComponent,
    SFXDirective,
    SlotRarityOutlineComponent,
    TippyDirective,
    TooltipSkillPreviewComponent,
  ],
  templateUrl: './panel-hero-burst-skills.component.html',
})
export class PanelHeroBurstSkillsComponent {
  // Includes skill tree discounts, which live in the skill's mods.
  public readonly epCost = skillEpCost;

  public character = input.required<Character>();
  public choose = output<EquipmentSkillContent>();

  public options = computed<EquipmentSkillContent[]>(() =>
    characterBurstSkillOptions(this.character()),
  );

  public chosenId = computed(
    () => characterChosenBurstSkills(this.character())[0]?.id,
  );

  public heroCombatant = computed(() =>
    combatantFromCharacter(this.character()),
  );

  public equippedWeaponTypes = computed(() =>
    equippedItemTypes(this.character().equipment),
  );

  public chooseSkill(skill: EquipmentSkillContent): void {
    if (skill.id === this.chosenId()) return;
    this.choose.emit(skill);
  }
}
