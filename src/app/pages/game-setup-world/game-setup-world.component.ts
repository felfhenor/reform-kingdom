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
import { IconStatComponent } from '@components/icon-stat/icon-stat.component';
import { SFXDirective } from '@directives/sfx.directive';
import { getEntry } from '@helpers/content';
import { discordSetMainStatus, discordSetStatus } from '@helpers/discord';
import { gameReset } from '@helpers/game-init';
import { getUnlockedJobs } from '@helpers/job';
import { createCharacter, setParty } from '@helpers/party';
import { rngChoiceIdentifiable } from '@helpers/rng';
import type { JobContent, JobId } from '@interfaces';
import { StatOrder, StatShorthand } from '@interfaces';
import { NgSelectComponent } from '@ng-select/ng-select';
import { StatDisplayPipe } from '@pipes/stat-display.pipe';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';
import { sortBy } from 'es-toolkit/compat';

const STARTING_JOB_NAMES = ['Warrior', 'Magician', 'Healer', 'Ranger'];
const STARTING_HERO_NAMES = ['Jala', 'Spoorle', 'Jacks', 'Pertil'];

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
    IconStatComponent,
    NgSelectComponent,
    FormField,
    StatDisplayPipe,
  ],
  templateUrl: './game-setup-world.component.html',
  styleUrl: './game-setup-world.component.scss',
})
export class GameSetupWorldComponent implements OnInit {
  private router = inject(Router);

  public unlockedJobs = computed(() =>
    sortBy(getUnlockedJobs(), (job) => job.name),
  );

  public statOrder = StatOrder;
  public statShorthand = StatShorthand;

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

  public randomizeJobs() {
    const jobs = this.unlockedJobs();
    if (jobs.length === 0) return;

    this.heroesModel.update((heroes) =>
      heroes.map((hero) => ({
        ...hero,
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
