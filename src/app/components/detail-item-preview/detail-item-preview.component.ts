import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { IconItemPreviewComponent } from '@components/icon-item-preview/icon-item-preview.component';
import { RowStatSummaryComponent } from '@components/row-stat-summary/row-stat-summary.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import {
  type CombatStatBlock,
  type ItemPreviewDisplay,
  type StatBlock,
  type StatusEffectBlock,
} from '@interfaces';

// Single item's preview body, reused by the headless tooltip and the equip-picker's two-column comparison.
@Component({
  selector: 'app-detail-item-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconItemPreviewComponent,
    RowStatSummaryComponent,
    SlotIconBlankComponent,
    AtlasImageComponent,
  ],
  templateUrl: './detail-item-preview.component.html',
  styleUrl: './detail-item-preview.component.scss',
})
export class DetailItemPreviewComponent {
  public display = input.required<ItemPreviewDisplay>();
  // Extra flat bonus (e.g. infusions), shown as its own row - unset for non-equipment.
  public bonusStats = input<StatBlock>();
  public bonusResistances = input<StatusEffectBlock>();
  public bonusCombatStats = input<CombatStatBlock>();

  // When set, stat/resistance/combat-stat rows show a colored delta badge
  // against this baseline (equip-picker's two-column comparison).
  public comparisonStats = input<StatBlock>();
  public comparisonResistances = input<StatusEffectBlock>();
  public comparisonCombatStats = input<CombatStatBlock>();

  public showEquippableBy = input<boolean>(true);
  public showDescription = input<boolean>(true);
}
