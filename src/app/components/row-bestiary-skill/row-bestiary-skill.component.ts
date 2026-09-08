import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RowSkillStatScalingComponent } from '@components/row-skill-stat-scaling/row-skill-stat-scaling.component';
import { SlotRarityOutlineComponent } from '@components/slot-rarity-outline/slot-rarity-outline.component';
import type { EquipmentSkillContent } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-row-bestiary-skill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RowSkillStatScalingComponent,

    TippyDirective,
    SlotRarityOutlineComponent,
  ],
  templateUrl: './row-bestiary-skill.component.html',
  styleUrl: './row-bestiary-skill.component.scss',
})
export class RowBestiarySkillComponent {
  public skill = input.required<EquipmentSkillContent>();
  // The skill's description with its `{{ value }}` placeholder already
  // resolved - the caller decides which level's stats to preview against.
  public description = input.required<string>();
}
