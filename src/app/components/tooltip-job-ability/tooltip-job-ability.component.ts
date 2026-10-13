import { DecimalPipe } from '@angular/common';
import type { TemplateRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  viewChild,
} from '@angular/core';
import { IconItemPreviewComponent } from '@components/icon-item-preview/icon-item-preview.component';
import { jobAbilityValueLabel } from '@helpers/hero/job-ability.ui';
import type { JobAbilityRow } from '@interfaces';

// Headless, like app-tooltip-skill-preview: callers hand `template()` to `[tp]`.
@Component({
  selector: 'app-tooltip-job-ability',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, IconItemPreviewComponent],
  templateUrl: './tooltip-job-ability.component.html',
  styleUrl: './tooltip-job-ability.component.scss',
})
export class TooltipJobAbilityComponent {
  public display = input.required<JobAbilityRow>();

  public template = viewChild.required<TemplateRef<unknown>>('tooltipContent');

  public jobAbilityValueLabel = jobAbilityValueLabel;
}
