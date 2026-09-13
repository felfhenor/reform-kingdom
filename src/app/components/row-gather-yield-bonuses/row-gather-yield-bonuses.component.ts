import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';

// Shared by the equipment tooltip and the infusion screen - anywhere a GatherYield bonus (base, infusion, or affix) needs the same icon+text row.
@Component({
  selector: 'app-row-gather-yield-bonuses',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SlotIconBlankComponent, AtlasImageComponent, DecimalPipe],
  templateUrl: './row-gather-yield-bonuses.component.html',
  styleUrl: './row-gather-yield-bonuses.component.scss',
})
export class RowGatherYieldBonusesComponent {
  public bonuses =
    input<{ tradeskillName: string; tradeskillSprite: string; value: number }[]>();
}
