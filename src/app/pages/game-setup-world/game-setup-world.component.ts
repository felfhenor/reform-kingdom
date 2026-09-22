import type { OnInit } from '@angular/core';
import { Component, computed, effect, inject, signal } from '@angular/core';
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
import { IconJobComponent } from '@components/icon-job/icon-job.component';
import { SFXDirective } from '@directives/sfx.directive';
import { getEntry } from '@helpers/content/content';
import {
  discordSetMainStatus,
  discordSetStatus,
} from '@helpers/engine/discord';
import { gameReset } from '@helpers/game-init';
import { getUnlockedJobs } from '@helpers/hero/job';
import { createCharacter, setParty } from '@helpers/hero/party';
import { rngChoiceIdentifiable } from '@helpers/rng';
import type { JobContent, JobId } from '@interfaces';
import { NgSelectComponent } from '@ng-select/ng-select';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';
import { sampleSize, sortBy } from 'es-toolkit/compat';

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
  imports: [
    SweetAlert2Module,
    SFXDirective,
    IconJobComponent,
    NgSelectComponent,
    FormField,
  ],
  templateUrl: './game-setup-world.component.html',
  styleUrl: './game-setup-world.component.scss',
})
export class GameSetupWorldComponent implements OnInit {
  private router = inject(Router);

  public unlockedJobs = computed(() =>
    sortBy(getUnlockedJobs(), (job) => job.name),
  );

  private heroesModel = signal<HeroPick[]>(
    sampleSize(STARTING_HERO_NAMES, 4).map((name) => ({
      name,
      jobId: '' as JobId,
    })),
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

  public randomize() {
    const jobs = this.unlockedJobs();
    if (jobs.length === 0) return;

    const names = sampleSize(STARTING_HERO_NAMES, 4);

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

    const party = this.heroesModel().map((hero) =>
      createCharacter(hero.name, hero.jobId),
    );

    gameReset();
    setParty(party);

    await this.router.navigate(['/setup', 'generate']);
  }
}
