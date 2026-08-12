import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { IconBlankSlotComponent } from '@components/icon-blank-slot/icon-blank-slot.component';
import type { EquipmentSkillContent } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-bestiary-skill-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AtlasImageComponent, IconBlankSlotComponent, TippyDirective],
  templateUrl: './bestiary-skill-row.component.html',
  styleUrl: './bestiary-skill-row.component.scss',
})
export class BestiarySkillRowComponent {
  public skill = input.required<EquipmentSkillContent>();
  // The skill's description with its `{{ value }}` placeholder already
  // resolved - the caller decides which level's stats to preview against
  // (see `BestiaryMonsterDetailComponent`'s min/max skill blocks).
  public description = input.required<string>();
}
