import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { ButtonKingdomBackComponent } from '@components/button-kingdom-back/button-kingdom-back.component';
import { IconJobComponent } from '@components/icon-job/icon-job.component';
import { FadeInDirective } from '@directives/fade-in.directive';
import { ListRowDirective } from '@directives/list-row.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { getEntry } from '@helpers/content/content';
import { ticksToDurationParts } from '@helpers/engine/timer.ui';
import { legacy } from '@helpers/legacy/legacy';
import { legacyRunScore } from '@helpers/legacy/legacy-score.ui';
import type { GameId, JobContent } from '@interfaces';
import { PluralizePipe } from '@pipes/pluralize.pipe';
import { sortBy } from 'es-toolkit/compat';

@Component({
  selector: 'app-legacy',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BlankSlateComponent,
    ButtonKingdomBackComponent,
    DatePipe,
    DecimalPipe,
    IconJobComponent,
    ListRowDirective,
    NgTemplateOutlet,
    PluralizePipe,
    SFXDirective,
  ],
  hostDirectives: [FadeInDirective],
  host: { class: 'block' },
  templateUrl: './legacy.component.html',
})
export class LegacyComponent {
  private router = inject(Router);

  public runs = computed(() =>
    sortBy(legacy().runs, (run) => -run.endedAt).map((run) => ({
      id: run.id,
      completed: run.outcome === 'Completed',
      endedAt: run.endedAt,
      playTime: ticksToDurationParts(run.ticks),
      edictCount: run.edicts.length,
      score: legacyRunScore(run).total,
      jobs: run.party.map((hero) => getEntry<JobContent>(hero.jobId)),
    })),
  );

  public openRun(id: GameId): void {
    void this.router.navigate(['/summary', id]);
  }

  public goHome = (): void => {
    void this.router.navigate(['/']);
  };
}
