import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import type { EquipmentSkillContent } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-row-bestiary-skill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AtlasImageComponent, SlotIconBlankComponent, TippyDirective],
  templateUrl: './row-bestiary-skill.component.html',
  styleUrl: './row-bestiary-skill.component.scss',
})
export class RowBestiarySkillComponent {
  public skill = input.required<EquipmentSkillContent>();
  // The skill's description with its `{{ value }}` placeholder already
  // resolved - the caller decides which level's stats to preview against
  // (see `DetailBestiaryMonsterComponent`'s min/max skill blocks).
  public description = input.required<string>();
}
