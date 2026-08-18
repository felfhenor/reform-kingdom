import {
  ChangeDetectionStrategy,
  Component,
  input,
  viewChild,
} from '@angular/core';
import type { TemplateRef } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { RowItemStatsComponent } from '@components/row-item-stats/row-item-stats.component';
import type { ItemPreviewDisplay } from '@interfaces';

// Headless: renders only an `ng-template` and exposes it via `template()`,
// for callers to hand to `[tp]` on whatever icon markup they render
// themselves (e.g. `[tp]="preview.template()"`).
@Component({
  selector: 'app-tooltip-item-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AtlasImageComponent, RowItemStatsComponent],
  templateUrl: './tooltip-item-preview.component.html',
  styleUrl: './tooltip-item-preview.component.scss',
})
export class TooltipItemPreviewComponent {
  public display = input<ItemPreviewDisplay>();

  public template = viewChild.required<TemplateRef<unknown>>('tooltipContent');
}
