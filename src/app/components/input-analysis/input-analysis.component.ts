import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AtlasAnimationComponent } from '@components/atlas-animation/atlas-animation.component';
import { IconComponent } from '@components/icon/icon.component';
import { IconJobComponent } from '@components/icon-job/icon-job.component';
import { getEntriesByType } from '@helpers/content';
import type {
  AnalysisInputDef,
  AnalysisInputValue,
  JobContent,
  MonsterContent,
} from '@interfaces';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { TippyDirective } from '@ngneat/helipopper';
import { sortBy } from 'es-toolkit/compat';

@Component({
  selector: 'app-input-analysis',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconComponent,
    IconJobComponent,
    AtlasAnimationComponent,
    FormsModule,
    NgSelectComponent,
    NgOptionTemplateDirective,
    NgLabelTemplateDirective,
    TippyDirective,
  ],
  templateUrl: './input-analysis.component.html',
})
export class InputAnalysisComponent {
  public def = input.required<AnalysisInputDef>();
  public value = input.required<AnalysisInputValue>();
  public supportingScripts = input.required<string>();

  public valueChange = output<AnalysisInputValue>();

  public jobs = sortBy(getEntriesByType<JobContent>('job'), (job) => job.name);
  public monsters = sortBy(
    getEntriesByType<MonsterContent>('monster'),
    (monster) => monster.name,
  );

  public numberFromEvent(event: Event): number {
    const value = Number((event.target as HTMLInputElement).value);
    return Number.isFinite(value) ? value : 0;
  }

  public checkedFromEvent(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  public textFromEvent(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  // ng-select's `(change)` emits the raw selected item objects regardless of
  // `bindValue` (only `[(ngModel)]`/`writeValue` apply that transform) - pull
  // `.name` out ourselves so callers always get plain strings.
  public namesFromSelection(selection: { name: string }[]): string[] {
    return selection.map((item) => item.name);
  }
}
