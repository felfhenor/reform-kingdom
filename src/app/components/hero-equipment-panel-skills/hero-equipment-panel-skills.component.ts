import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { IconBlankSlotComponent } from '@components/icon-blank-slot/icon-blank-slot.component';
import {
  combatantFromCharacter,
  equippedItemTypes,
  getEntry,
  heroSkillsWithEquipment,
  skillDescriptionWithPreview,
  skillIsUsableWithEquippedWeapons,
} from '@helpers';
import type {
  Character,
  Combatant,
  EquipmentItemType,
  EquipmentSkillContent,
  JobContent,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-hero-equipment-panel-skills',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AtlasImageComponent, IconBlankSlotComponent, TippyDirective],
  host: {
    class: 'flex flex-col gap-2 overflow-y-auto',
  },
  templateUrl: './hero-equipment-panel-skills.component.html',
  styleUrl: './hero-equipment-panel-skills.component.scss',
})
export class HeroEquipmentPanelSkillsComponent {
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
