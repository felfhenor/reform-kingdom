import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { RowSkillStatScalingComponent } from '@components/row-skill-stat-scaling/row-skill-stat-scaling.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { combatantFromCharacter } from '@helpers/combat/combat-create';
import { getEntry } from '@helpers/content';
import { heroSkillsWithEquipment } from '@helpers/hero/job';
import { skillIsUsableWithEquippedWeapons } from '@helpers/hero/skill';
import { skillDescriptionWithPreview } from '@helpers/hero/skill-preview';
import { equippedItemTypes } from '@helpers/item/equipment';
import type {
  Character,
  Combatant,
  EquipmentItemType,
  EquipmentSkillContent,
  JobContent,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-panel-hero-equipment-skills',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    RowSkillStatScalingComponent,
    SlotIconBlankComponent,
    TippyDirective,
  ],
  host: {
    class: 'flex flex-col gap-2 overflow-y-auto',
  },
  templateUrl: './panel-hero-equipment-skills.component.html',
  styleUrl: './panel-hero-equipment-skills.component.scss',
})
export class PanelHeroEquipmentSkillsComponent {
  public character = input.required<Character>();

  public job = computed<JobContent | undefined>(() =>
    getEntry<JobContent>(this.character().jobId),
  );

  public heroSkills = computed<EquipmentSkillContent[]>(() => {
    const job = this.job();
    if (!job) return [];

    return heroSkillsWithEquipment(
      job,
      this.character().level,
      this.character().equipment,
    );
  });

  public equippedWeaponTypes = computed<EquipmentItemType[]>(() =>
    equippedItemTypes(this.character().equipment),
  );

  private combatant = computed<Combatant>(() =>
    combatantFromCharacter(this.character()),
  );

  public isSkillUsable(skill: EquipmentSkillContent): boolean {
    return skillIsUsableWithEquippedWeapons(skill, this.equippedWeaponTypes());
  }

  public skillDescription(skill: EquipmentSkillContent): string {
    return skillDescriptionWithPreview(this.combatant(), skill);
  }
}
