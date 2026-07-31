import type { OnInit } from '@angular/core';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { applyEach, FormField, form, required, schema } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { AtlasAnimationComponent } from '@components/atlas-animation/atlas-animation.component';
import { SFXDirective } from '@directives/sfx.directive';
import {
  createCharacter,
  discordSetStatus,
  gameReset,
  getEntry,
  getUnlockedJobs,
  setParty,
  setWorldSeed,
} from '@helpers';
import type { JobContent, JobId } from '@interfaces';
import { NgSelectComponent } from '@ng-select/ng-select';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';
import { sortBy } from 'es-toolkit/compat';

const STARTING_JOB_NAME = 'Explorer';
const STARTING_HERO_NAMES = ['Jala', 'Spoorle', 'Jacks', 'Pertil'];

type HeroPick = {
  name: string;
  jobId: JobId;
};

const heroPickSchema = schema<HeroPick>((hero) => {
  required(hero.name);
  required(hero.jobId);
});

@Component({
  selector: 'app-game-setup-world',
  imports: [
    SweetAlert2Module,
    SFXDirective,
    AtlasAnimationComponent,
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
    STARTING_HERO_NAMES.map((name) => ({ name, jobId: '' as JobId })),
  );

  public partyForm = form(this.heroesModel, (heroes) => {
    applyEach(heroes, heroPickSchema);
  });

  constructor() {
    // Job content loads asynchronously; backfill the starting job once it arrives.
    effect(() => {
      const jobs = this.unlockedJobs();
      if (jobs.length === 0) return;

      const startingJobId =
        jobs.find((job) => job.name === STARTING_JOB_NAME)?.id ?? jobs[0].id;

      this.heroesModel.update((heroes) =>
        heroes.map((hero) =>
          hero.jobId ? hero : { ...hero, jobId: startingJobId },
        ),
      );
    });
  }

  ngOnInit() {
    discordSetStatus({
      state: 'Starting a new game...',
    });
  }

  public jobFor(jobId: JobId): JobContent | undefined {
    return getEntry<JobContent>(jobId);
  }

  public async createWorld() {
    if (this.partyForm().invalid()) return;

    const party = this.heroesModel().map((hero) =>
      createCharacter(hero.name, hero.jobId),
    );

    gameReset();
    setWorldSeed(undefined);
    setParty(party);

    await this.router.navigate(['/setup', 'generate']);
  }
}
