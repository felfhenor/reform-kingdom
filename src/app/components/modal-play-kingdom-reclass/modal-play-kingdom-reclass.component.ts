import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  signal,
  untracked,
} from '@angular/core';
import {
  applyEach,
  form,
  FormField,
  required,
  schema,
} from '@angular/forms/signals';
import { IconJobComponent } from '@components/icon-job/icon-job.component';
import { ModalComponent } from '@components/modal/modal.component';
import { characterReclass } from '@helpers/character-reclass';
import { getEntry } from '@helpers/content';
import { getUnlockedJobs } from '@helpers/job';
import { partyGet } from '@helpers/party';
import { showReclassHeroesModal } from '@helpers/ui';
import type { Character, JobContent, JobId } from '@interfaces';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';
import { sortBy } from 'es-toolkit/compat';

type ReclassPick = {
  jobId: JobId;
};

const reclassPickSchema = schema<ReclassPick>((pick) => {
  required(pick.jobId);
});

@Component({
  selector: 'app-modal-play-kingdom-reclass',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ModalComponent,
    IconJobComponent,
    NgSelectComponent,
    NgOptionTemplateDirective,
    NgLabelTemplateDirective,
    FormField,
    SweetAlert2Module,
  ],
  templateUrl: './modal-play-kingdom-reclass.component.html',
})
export class ModalPlayKingdomReclassComponent {
  public isVisible = computed(() => showReclassHeroesModal());
  public party = computed(() => partyGet());

  public unlockedJobs = computed(() =>
    sortBy(getUnlockedJobs(), (job) => job.name),
  );

  private picksModel = signal<ReclassPick[]>([]);

  public reclassForm = form(this.picksModel, (picks) => {
    applyEach(picks, reclassPickSchema);
  });

  public hasChanges = computed(() =>
    this.picksModel().some(
      (pick, index) => pick.jobId !== this.party()[index]?.jobId,
    ),
  );

  constructor() {
    // Reseed the pickers from the live party each time the modal is opened.
    effect(() => {
      if (!this.isVisible()) return;

      untracked(() => {
        this.picksModel.set(
          this.party().map((character) => ({ jobId: character.jobId })),
        );
      });
    });
  }

  public jobFor(jobId: JobId): JobContent | undefined {
    return getEntry<JobContent>(jobId);
  }

  public applyReclassAll(): void {
    const party = this.party();

    this.picksModel().forEach((pick, index) => {
      const character = party[index];
      if (character && pick.jobId !== character.jobId) {
        characterReclass(character.id, pick.jobId);
      }
    });
  }

  public close(): void {
    showReclassHeroesModal.set(false);
  }

  public jobLevelForHero(hero: Character, job: JobId): number {
    if (hero.jobId === job) return hero.level;
    return hero.jobProgress[job]?.level ?? 1;
  }
}
