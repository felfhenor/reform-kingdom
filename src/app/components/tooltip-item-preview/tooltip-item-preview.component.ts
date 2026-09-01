import {
  ChangeDetectionStrategy,
  Component,
  input,
  viewChild,
} from '@angular/core';
import type { TemplateRef } from '@angular/core';
import { IconItemPreviewComponent } from '@components/icon-item-preview/icon-item-preview.component';
import { RowItemStatsComponent } from '@components/row-item-stats/row-item-stats.component';
import { RowLabeledValuesComponent } from '@components/row-labeled-values/row-labeled-values.component';
import {
  CombatStatDimension,
  StatusEffectTagDimension,
  type CombatantCombatStats,
  type ItemPreviewDisplay,
  type StatBlock,
  type StatusEffectTag,
} from '@interfaces';

// Headless: renders only an `ng-template` and exposes it via `template()`,
// for callers to hand to `[tp]` on whatever icon markup they render
// themselves (e.g. `[tp]="preview.template()"`).
@Component({
  selector: 'app-tooltip-item-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconItemPreviewComponent,
    RowItemStatsComponent,
    RowLabeledValuesComponent,
  ],
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
  // Same idea as `bonusStats`, for combat stats.
  public bonusCombatStats = input<CombatantCombatStats>();

  public resistanceDimension = StatusEffectTagDimension;
  public combatStatDimension = CombatStatDimension;

  public template = viewChild.required<TemplateRef<unknown>>('tooltipContent');
}
