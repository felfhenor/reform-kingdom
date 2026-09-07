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
  // Extra bonus (e.g. from infusions/affixes) shown as its own set of rows,
  // always in green/rose, below the base rows.
  public bonusValues = input<Record<string, number>>();
  // 'column' (default) for tooltips/detail panels, full sentence per row;
  // 'row' for compact space-constrained lists.
  public layout = input<'column' | 'row'>('column');

  private sortedNonzero(values: Record<string, number> | undefined): string[] {
    if (!values) return [];
    return this.dimension().order.filter((key) => (values[key] ?? 0) !== 0);
  }

  public baseRows = computed<string[]>(() => this.sortedNonzero(this.values()));

  public bonusRows = computed<string[]>(() =>
    this.sortedNonzero(this.bonusValues()),
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
}
