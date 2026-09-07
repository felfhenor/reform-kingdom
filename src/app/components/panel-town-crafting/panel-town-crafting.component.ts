import { DecimalPipe, formatNumber } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { IconComponent } from '@components/icon/icon.component';
import { IconItemPreviewComponent } from '@components/icon-item-preview/icon-item-preview.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import {
  townCraftQueueRows,
  townTradeskillLevelRows,
} from '@helpers/town/crafting/town-craft-display.ui';
import { townCraftQueueSize } from '@helpers/town/crafting/town-craft-queue-size';
import type {
  TownContent,
  TownCraftQueueRow,
  TownTradeskillLevelRow,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-panel-town-crafting',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    DecimalPipe,
    IconComponent,
    IconItemPreviewComponent,
    SlotIconBlankComponent,
    TippyDirective,
  ],
  host: { class: 'flex flex-col gap-4' },
  templateUrl: './panel-town-crafting.component.html',
})
export class PanelTownCraftingComponent {
  private locale = inject(LOCALE_ID);

  public town = input.required<TownContent>();

  public tradeskillLevelRows = computed<TownTradeskillLevelRow[]>(() =>
    townTradeskillLevelRows(this.town().id),
  );

  public tradeskillTooltip(row: TownTradeskillLevelRow): string {
    const name = row.isSpecialty ? `${row.name} (Speciality)` : row.name;
    const reduction = formatNumber(row.level, this.locale);
    return `${name}: -${reduction}% crafting time for matching recipes`;
  }

  public craftQueueRows = computed<TownCraftQueueRow[]>(() =>
    townCraftQueueRows(this.town().id),
  );

  // Fixed length so the grid always shows every slot up to the reputation-scaled max, not just the filled ones.
  public craftQueueSlots = computed<undefined[]>(() =>
    new Array(townCraftQueueSize(this.town())).fill(undefined),
  );
}
