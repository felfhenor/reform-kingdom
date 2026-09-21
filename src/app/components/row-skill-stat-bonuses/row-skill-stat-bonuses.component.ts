import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import type { SkillStatBonusDisplay } from '@interfaces';
import { StatShorthand } from '@interfaces';

// Shared by the equipment tooltip and the infusion screen.
@Component({
  selector: 'app-row-skill-stat-bonuses',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SlotIconBlankComponent, AtlasImageComponent, DecimalPipe],
  templateUrl: './row-skill-stat-bonuses.component.html',
})
export class RowSkillStatBonusesComponent {
  public bonuses = input<SkillStatBonusDisplay[]>();

  public statShorthand = StatShorthand;
}
