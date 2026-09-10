import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { SlotRarityOutlineComponent } from '@components/slot-rarity-outline/slot-rarity-outline.component';
import { TooltipSkillPreviewComponent } from '@components/tooltip-skill-preview/tooltip-skill-preview.component';
import { combatantFromCharacter } from '@helpers/combat/combat-create';
import { getEntry } from '@helpers/content/content';
import { heroSkillsWithEquipment } from '@helpers/hero/job';
import { equippedItemTypes } from '@helpers/item/equipment';
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
    TippyDirective,
    SlotRarityOutlineComponent,
    TooltipSkillPreviewComponent,
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

  public heroSkills = computed<EquipmentSkillContent[]>(() => {
    const job = this.job();
    if (!job) return [];

    return heroSkillsWithEquipment(
      job,
      this.character().level,
      this.character().equipment,
    );
  });

  public heroCombatant = computed(() =>
    combatantFromCharacter(this.character()),
  );

  public equippedWeaponTypes = computed<EquipmentItemType[]>(() =>
    equippedItemTypes(this.character().equipment),
  );
}
