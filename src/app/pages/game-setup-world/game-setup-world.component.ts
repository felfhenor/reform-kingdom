import { DecimalPipe } from '@angular/common';
import type { AnimationCallbackEvent, OnInit } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import {
  applyEach,
  form,
  FormField,
  maxLength,
  minLength,
  required,
  schema,
} from '@angular/forms/signals';
import { Router } from '@angular/router';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { IconJobComponent } from '@components/icon-job/icon-job.component';
import { RowEdictComponent } from '@components/row-edict/row-edict.component';
import { SlotEdictComponent } from '@components/slot-edict/slot-edict.component';
import { ListReflowDirective } from '@directives/list-reflow.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { PARTY_SIZE_MAX } from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import {
  edictIsBlocked,
  edictsPickable,
  edictsSanitized,
} from '@helpers/edict/edict';
import {
  edictKindGroupLabel,
  edictScoreMultiplier,
  edictsFragmentTotal,
  edictsSet,
  edictsTrackRun,
} from '@helpers/edict/edict.ui';
import {
  discordSetMainStatus,
  discordSetStatus,
} from '@helpers/engine/discord';
import { gameReset, gameStart } from '@helpers/game-init';
import { titleCrawlQueue } from '@helpers/lore/title-crawl.ui';
import { getUnlockedJobs } from '@helpers/hero/job';
import { createCharacter, setParty } from '@helpers/hero/party';
import { rngChoiceIdentifiable } from '@helpers/rng';
import { isSetup } from '@helpers/setup';
import { setOption } from '@helpers/state-options';
import type { EdictContent, EdictId, JobContent, JobId } from '@interfaces';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { AnimationService } from '@services/animation.service';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';
import { sampleSize, sortBy, uniq } from 'es-toolkit/compat';

const STARTING_JOB_NAMES = ['Warrior', 'Magician', 'Healer', 'Ranger'];
const STARTING_HERO_NAMES = [
  'Jala',
  'Spoorle',
  'Jacks',
  'Pertil',
  'Matango',
  'Chaed',
  'Loen',
  'Feysac',
  'Guy',
  'Artea',
  'Cecil',
  'Talinar',
  'Koss',
  'Regas',
  'Drevigo',
  'Ashur',
  'Klein',
  'Spoodles',
  'Leon',
  'Laeticia',
  'Sophia',
  'Moore',
  'Wendel',
  'Gaur',
  'Jad',
];

type HeroPick = {
  name: string;
  jobId: JobId;
};

const heroPickSchema = schema<HeroPick>((hero) => {
  minLength(hero.name, 1);
  maxLength(hero.name, 20);
  required(hero.name);
  required(hero.jobId);
});

@Component({
  selector: 'app-game-setup-world',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SweetAlert2Module,
    SFXDirective,
    IconJobComponent,
    NgSelectComponent,
    NgOptionTemplateDirective,
    NgLabelTemplateDirective,
    FormField,
    BlankSlateComponent,
    RowEdictComponent,
    SlotEdictComponent,
    DecimalPipe,
    ListReflowDirective,
  ],
  templateUrl: './game-setup-world.component.html',
  styleUrl: './game-setup-world.component.scss',
})
export class GameSetupWorldComponent implements OnInit {
  private router = inject(Router);
  private anim = inject(AnimationService);

  public unlockedJobs = computed(() =>
    sortBy(getUnlockedJobs(), (job) => job.name),
  );

  private heroesModel = signal<HeroPick[]>(
    sampleSize(STARTING_HERO_NAMES, PARTY_SIZE_MAX).map((name) => ({
      name,
      jobId: '' as JobId,
    })),
  );

  public pickedEdictIds = signal<EdictId[]>([]);

  public pickableEdicts = computed(() => edictsPickable());
  public pickedEdicts = computed(() =>
    this.pickedEdictIds().flatMap((id) => {
      const edict = this.pickableEdicts().find((entry) => entry.id === id);
      return edict ? [edict] : [];
    }),
  );
  public edictGroups = computed(() =>
    uniq(this.pickableEdicts().map((edict) => edict.kind)).map((kind) => ({
      kind,
      label: edictKindGroupLabel(kind),
      edicts: this.pickableEdicts().filter((edict) => edict.kind === kind),
    })),
  );
  public fragmentTotal = computed(() =>
    edictsFragmentTotal(this.pickedEdicts()),
  );
  public scoreMultiplier = computed(() =>
    edictScoreMultiplier(this.fragmentTotal()),
  );

  public partyForm = form(this.heroesModel, (heroes) => {
    applyEach(heroes, heroPickSchema);
  });

  constructor() {
    // Job content loads asynchronously; backfill the starting job once it arrives.
    effect(() => {
      const jobs = this.unlockedJobs();
      if (jobs.length === 0) return;

      this.heroesModel.update((heroes) =>
        heroes.map((hero, index) =>
          hero.jobId
            ? hero
            : {
                ...hero,
                jobId:
                  jobs.find((job) => job.name === STARTING_JOB_NAMES[index])
                    ?.id ?? jobs[0].id,
              },
        ),
      );
    });
  }

  ngOnInit() {
    discordSetMainStatus('');
    discordSetStatus({
      state: 'Starting a new game...',
    });
  }

  public jobFor(jobId: JobId): JobContent | undefined {
    return getEntry<JobContent>(jobId);
  }

  public isEdictPicked(edict: EdictContent): boolean {
    return this.pickedEdictIds().includes(edict.id);
  }

  public isEdictBlocked(edict: EdictContent): boolean {
    return edictIsBlocked(edict, this.pickedEdicts());
  }

  public onEdictRowLeave(event: AnimationCallbackEvent): void {
    this.anim
      .fadeOut(event.target)
      .then(() => event.animationComplete())
      .catch(() => event.animationComplete());
  }

  public toggleEdict(edict: EdictContent): void {
    if (this.isEdictBlocked(edict)) return;

    const picked = this.pickedEdictIds();
    const next = picked.includes(edict.id)
      ? picked.filter((id) => id !== edict.id)
      : [...picked, edict.id];
    this.pickedEdictIds.set(edictsSanitized(next));
  }

  public randomize() {
    const jobs = this.unlockedJobs();
    if (jobs.length === 0) return;

    const names = sampleSize(STARTING_HERO_NAMES, PARTY_SIZE_MAX);

    this.heroesModel.update((heroes) =>
      heroes.map((hero, i) => ({
        ...hero,
        name: names[i],
        jobId: (rngChoiceIdentifiable(jobs) ?? hero.jobId) as JobId,
      })),
    );
  }

  public async createWorld() {
    if (this.partyForm().invalid()) return;

    // Starting a game without answering the consent prompt counts as declining it.
    setOption('analyticsOptInDismissed', true);

    // Reset first: hero stats read the run's edicts, which must not be the previous run's.
    gameReset();
    await edictsSet(this.pickedEdictIds());
    const party = this.heroesModel().map((hero) =>
      createCharacter(hero.name, hero.jobId),
    );
    setParty(party);
    await titleCrawlQueue();
    await gameStart();
    if (isSetup()) edictsTrackRun();

    await this.router.navigate(['/game']);
  }
}
