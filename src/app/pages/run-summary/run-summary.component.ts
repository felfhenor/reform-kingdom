import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { Router } from '@angular/router';
import { BarProgressComponent } from '@components/bar-progress/bar-progress.component';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { IconJobComponent } from '@components/icon-job/icon-job.component';
import { RowEdictComponent } from '@components/row-edict/row-edict.component';
import { FadeInDirective } from '@directives/fade-in.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { getEntry } from '@helpers/content/content';
import { edictEntry } from '@helpers/edict/edict';
import { ticksToDurationParts } from '@helpers/engine/timer.ui';
import { legacyRunById } from '@helpers/legacy/legacy';
import {
  remembranceOverall,
  remembranceRow,
} from '@helpers/remembrance/remembrance.ui';
import { isSetup } from '@helpers/setup';
import type { GameId, JobContent } from '@interfaces';
import { PluralizePipe } from '@pipes/pluralize.pipe';

@Component({
  selector: 'app-run-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BarProgressComponent,
    BlankSlateComponent,
    DatePipe,
    DecimalPipe,
    IconJobComponent,
    NgTemplateOutlet,
    PluralizePipe,
    RowEdictComponent,
    SFXDirective,
  ],
  hostDirectives: [FadeInDirective],
  host: { class: 'block' },
  templateUrl: './run-summary.component.html',
})
export class RunSummaryComponent {
  private router = inject(Router);

  public runId = input.required<string>();

  public run = computed(() => legacyRunById(this.runId() as GameId));
  public canStartNewRun = computed(() => !isSetup());

  public playTime = computed(() =>
    ticksToDurationParts(this.run()?.ticks ?? 0),
  );

  public party = computed(() =>
    (this.run()?.party ?? []).map((hero) => ({
      ...hero,
      job: getEntry<JobContent>(hero.jobId),
    })),
  );

  public edicts = computed(() =>
    (this.run()?.edicts ?? []).map((id) => ({ id, edict: edictEntry(id) })),
  );

  public journeyStats = computed(() => {
    const stats = this.run()?.stats;
    if (!stats) return [];

    return [
      { label: 'Monsters defeated', value: stats.kills },
      { label: 'Monster types defeated', value: stats.monstersKilled },
      { label: 'Maps reached', value: stats.mapsReached },
      { label: 'Towns visited', value: stats.townsVisited },
      ...(stats.run
        ? [
            { label: 'Gold earned', value: stats.run.goldEarned },
            { label: 'Fights won', value: stats.run.fightsWon },
            { label: 'Fights lost', value: stats.run.fightsLost },
            { label: 'Items crafted', value: stats.run.itemsCrafted },
          ]
        : []),
    ];
  });
  public hasRunTotals = computed(() => !!this.run()?.stats.run);
  // Runs that began before tracking only count the play after it started.
  public trackedPlayTime = computed(() => {
    const run = this.run();
    const from = run?.stats.run?.trackedFromTick ?? 0;
    return run && from > 0 ? ticksToDurationParts(run.ticks - from) : undefined;
  });
  public isFelTickUntracked = computed(() => {
    const run = this.run();
    return (
      run?.outcome === 'Completed' &&
      !!run.stats.run &&
      run.stats.run.felDefeatedTick === undefined
    );
  });
  public felDefeatedAt = computed(() => {
    const tick = this.run()?.stats.run?.felDefeatedTick;
    return tick === undefined ? undefined : ticksToDurationParts(tick);
  });

  public completionRows = computed(() =>
    (this.run()?.stats.completion ?? []).map(remembranceRow),
  );
  public completionOverall = computed(() =>
    remembranceOverall(this.completionRows()),
  );

  public startNewRun(): void {
    void this.router.navigate(['/setup']);
  }

  public goHome(): void {
    void this.router.navigate(['/']);
  }
}
