import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SlotRarityOutlineComponent } from '@components/slot-rarity-outline/slot-rarity-outline.component';
import { TooltipSkillPreviewComponent } from '@components/tooltip-skill-preview/tooltip-skill-preview.component';
import type { Combatant, EquipmentSkillContent } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-row-bestiary-skill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TippyDirective,
    SlotRarityOutlineComponent,
    TooltipSkillPreviewComponent,
  ],
  templateUrl: './row-bestiary-skill.component.html',
  styleUrl: './row-bestiary-skill.component.scss',
})
export class RowBestiarySkillComponent {
  public skill = input.required<EquipmentSkillContent>();
  public usingCombatant = input.required<Combatant>();
}
