import {
  ChangeDetectionStrategy,
  Component,
  input,
  viewChild,
} from '@angular/core';
import type { TemplateRef } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { RowDebuffResistancesComponent } from '@components/row-debuff-resistances/row-debuff-resistances.component';
import { RowItemStatsComponent } from '@components/row-item-stats/row-item-stats.component';
import type { ItemPreviewDisplay, StatBlock, StatusEffectTag } from '@interfaces';

// Headless: renders only an `ng-template` and exposes it via `template()`,
// for callers to hand to `[tp]` on whatever icon markup they render
// themselves (e.g. `[tp]="preview.template()"`).
@Component({
  selector: 'app-tooltip-item-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AtlasImageComponent, RowItemStatsComponent, RowDebuffResistancesComponent],
  templateUrl: './tooltip-item-preview.component.html',
  styleUrl: './tooltip-item-preview.component.scss',
})
export class TooltipItemPreviewComponent {
  public display = input<ItemPreviewDisplay>();
  // Extra flat bonus (e.g. from infusions) shown as its own set of rows in
  // the stats block - see `RowItemStatsComponent.bonusStats`. Only ever
  // meaningful for equipment, so most callers leave this unset.
  public bonusStats = input<StatBlock>();
  // Same idea as `bonusStats`, for per-tag debuff resistance.
  public bonusResistances = input<Record<StatusEffectTag, number>>();

  public template = viewChild.required<TemplateRef<unknown>>('tooltipContent');
}
