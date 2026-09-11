import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent } from '@components/icon/icon.component';
import type { Icon, StatDisplayDimension } from '@interfaces';
import { StatDisplayPipe } from '@pipes/stat-display.pipe';

@Component({
  selector: 'app-row-labeled-values',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, StatDisplayPipe],
  templateUrl: './row-labeled-values.component.html',
  styleUrl: './row-labeled-values.component.scss',
})
export class RowLabeledValuesComponent {
  public dimension = input.required<StatDisplayDimension>();
  public values = input<Record<string, number>>();
  // Extra bonus (e.g. from infusions/affixes), merged into the base value
  // it modifies rather than shown as its own row.
  public bonusValues = input<Record<string, number>>();
  // When set, rows show a colored delta badge against this baseline (base+bonus
  // total) next to the raw value, e.g. the equip-picker's two-column comparison.
  public comparisonValues = input<Record<string, number>>();
  // 'column' (default) for tooltips/detail panels, full sentence per row;
  // 'row' for compact space-constrained lists.
  public layout = input<'column' | 'row'>('column');

  public hasComparison = computed(() => !!this.comparisonValues());

  public baseRows = computed<string[]>(() =>
    this.dimension().order.filter(
      (key) => this.baseValue(key) !== 0 || this.bonusValue(key) !== 0,
    ),
  );

  public label(key: string): string {
    return this.dimension().label[key];
  }

  public icon(key: string): Icon {
    return this.dimension().icon[key];
  }

  public suffix(key: string): string {
    return (this.dimension().isPercent?.[key] ?? true) ? '%' : '';
  }

  public baseValue(key: string): number {
    return this.values()?.[key] ?? 0;
  }

  public bonusValue(key: string): number {
    return this.bonusValues()?.[key] ?? 0;
  }

  public totalValue(key: string): number {
    return this.baseValue(key) + this.bonusValue(key);
  }

  public deltaValue(key: string): number {
    const comparison = this.comparisonValues();
    return comparison ? this.totalValue(key) - (comparison[key] ?? 0) : 0;
  }
}
