import { TPipe } from '@pipes/t.pipe';
import {
  durationPartText,
  formatDurationDelta,
  ticksToDurationParts,
} from '@helpers/engine/timer.ui';
import { contentNameById } from '@helpers/i18n/i18n-content';
import { ContentNamePipe } from '@pipes/content-name.pipe';
import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { Router } from '@angular/router';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { BarProgressComponent } from '@components/bar-progress/bar-progress.component';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { IconItemPreviewComponent } from '@components/icon-item-preview/icon-item-preview.component';
import { IconJobComponent } from '@components/icon-job/icon-job.component';
import { IconSpecComponent } from '@components/icon-spec/icon-spec.component';
import { IconComponent } from '@components/icon/icon.component';
import { TooltipAchievementComponent } from '@components/tooltip-achievement/tooltip-achievement.component';
import { RowEdictComponent } from '@components/row-edict/row-edict.component';
import { FadeInDirective } from '@directives/fade-in.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { achievementsEarnedByRun } from '@helpers/achievement/achievement.ui';
import { getEntry } from '@helpers/content/content';
import { edictEntry } from '@helpers/edict/edict';
import { formatDuration } from '@helpers/engine/timer';
import { skillFamilyEntry } from '@helpers/hero/skill';
import { legacyRunById } from '@helpers/legacy/legacy';
import { modsAffectGameplay } from '@helpers/mod/mod-registry';
import { modsListLabel } from '@helpers/mod/mod-registry.ui';
import {
  legacyRunScore,
  legacyUnsealedRegions,
} from '@helpers/legacy/legacy-score.ui';
import {
  legacyBestTimedRun,
  legacyHeroMostUsedSkill,
  legacyHeroStatRows,
  legacyRunAwards,
  legacyRunOutcomeTitle,
} from '@helpers/legacy/legacy.ui';
import {
  remembranceOverall,
  remembranceRow,
} from '@helpers/remembrance/remembrance.ui';
import { isSetup } from '@helpers/setup';
import type { GameId, JobContent } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

function withSkill<T extends { skillFamily: string }>(used: T | undefined) {
  return used
    ? { ...used, skill: skillFamilyEntry(used.skillFamily) }
    : undefined;
}

@Component({
  selector: 'app-run-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TPipe,
    ContentNamePipe,
    AtlasImageComponent,
    BarProgressComponent,
    BlankSlateComponent,
    DatePipe,
    DecimalPipe,
    IconItemPreviewComponent,
    IconJobComponent,
    IconSpecComponent,
    NgTemplateOutlet,
    RowEdictComponent,
    SFXDirective,
    IconComponent,
    TippyDirective,
    TooltipAchievementComponent,
  ],
  hostDirectives: [FadeInDirective],
  host: { class: 'block' },
  templateUrl: './run-summary.component.html',
})
export class RunSummaryComponent {
  public readonly durationPartText = durationPartText;
  private router = inject(Router);

  public runId = input.required<string>();

  public run = computed(() => legacyRunById(this.runId() as GameId));

  public modsLabel = computed(() => {
    const mods = this.run()?.mods;
    return modsAffectGameplay(mods) ? modsListLabel(mods ?? []) : undefined;
  });
  public achievements = computed(() =>
    achievementsEarnedByRun(this.runId() as GameId),
  );
  public outcomeTitle = computed(() => {
    const run = this.run();
    return run ? legacyRunOutcomeTitle(run.outcome) : '';
  });
  public canStartNewRun = computed(() => !isSetup());

  public playTime = computed(() =>
    ticksToDurationParts(this.run()?.ticks ?? 0),
  );

  public timedResult = computed(() => {
    const run = this.run();
    if (run?.outcome !== 'Completed' || run.timed !== true) return undefined;

    const previousBest = legacyBestTimedRun(run.endedAt);
    return {
      time: formatDuration(run.ticks),
      isPersonalBest: !previousBest || run.ticks < previousBest.ticks,
      delta: previousBest
        ? formatDurationDelta(run.ticks - previousBest.ticks)
        : undefined,
    };
  });

  private awards = computed(() => {
    const run = this.run();
    return run ? legacyRunAwards(run) : [];
  });

  public party = computed(() =>
    (this.run()?.party ?? []).map((hero, index) => ({
      ...hero,
      job: getEntry<JobContent>(hero.jobId),
      statRows: hero.stats ? legacyHeroStatRows(hero.stats) : undefined,
      biggestHit: withSkill(hero.stats?.biggestHit),
      mostUsed: withSkill(
        hero.stats ? legacyHeroMostUsedSkill(hero.stats) : undefined,
      ),
      awards: this.awards()
        .filter((award) => award.heroIndex === index)
        .map((award) => award.label),
      jobsUsedText: (hero.snapshot?.jobsUsed ?? [])
        .map((jobId) => contentNameById(jobId) ?? 'Unknown Job')
        .join(', '),
    })),
  );

  public edicts = computed(() =>
    (this.run()?.edicts ?? []).map((id) => ({ id, edict: edictEntry(id) })),
  );

  public journeyStats = computed(() => {
    const stats = this.run()?.stats;
    if (!stats) return [];

    return [
      { label: 'Monsters Defeated', value: stats.kills },
      { label: 'Monster Types Defeated', value: stats.monstersKilled },
      { label: 'Maps Reached', value: stats.mapsReached },
      { label: 'Towns Visited', value: stats.townsVisited },
      ...(stats.run
        ? [
            { label: 'Gold Earned', value: stats.run.goldEarned },
            { label: 'Fights Won', value: stats.run.fightsWon },
            { label: 'Fights Lost', value: stats.run.fightsLost },
            { label: 'Items Crafted', value: stats.run.itemsCrafted },
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

  public score = computed(() => {
    const run = this.run();
    return run ? legacyRunScore(run) : undefined;
  });

  public sealRows = computed(() =>
    (this.score()?.seals ?? []).map((seal) => {
      const parDelta = seal.region.seal.parTicks - seal.tick;
      return {
        name: seal.region.name,
        sealedAt: ticksToDurationParts(seal.tick),
        parDelta: ticksToDurationParts(Math.abs(parDelta)),
        isUnderPar: parDelta >= 0,
        points: seal.sealPoints + seal.speedPoints,
      };
    }),
  );

  public unsealedRegions = computed(() => {
    const run = this.run();
    return run ? legacyUnsealedRegions(run) : [];
  });

  public sealsTrackedPlayTime = computed(() => {
    const run = this.run();
    const from = run?.stats.run?.sealsTrackedFromTick ?? 0;
    return run && from > 0 ? ticksToDurationParts(run.ticks - from) : undefined;
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

  public openLegacy(): void {
    void this.router.navigate(['/legacy']);
  }
}
