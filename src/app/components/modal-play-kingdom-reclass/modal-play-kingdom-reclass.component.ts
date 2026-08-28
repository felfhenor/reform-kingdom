import { DecimalPipe } from '@angular/common';
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
import { CurrencyCostComponent } from '@components/currency-cost/currency-cost';
import { IconJobComponent } from '@components/icon-job/icon-job.component';
import { ModalComponent } from '@components/modal/modal.component';
import { getEntry } from '@helpers/content';
import { modalIsOpen } from '@helpers/engine/modal-stack';
import {
  characterJobLevel,
  characterReclassCost,
  charactersReclass,
} from '@helpers/hero/character-reclass';
import { getUnlockedJobs } from '@helpers/hero/job';
import { partyGet } from '@helpers/hero/party';
import { goldCoinId, hasGold } from '@helpers/item/materials';
import type {
  Character,
  CharacterReclassPick,
  JobContent,
  JobId,
} from '@interfaces';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';
import { sortBy, sum } from 'es-toolkit/compat';

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
    CurrencyCostComponent,
    NgSelectComponent,
    NgOptionTemplateDirective,
    NgLabelTemplateDirective,
    FormField,
    DecimalPipe,
    SweetAlert2Module,
  ],
  templateUrl: './modal-play-kingdom-reclass.component.html',
})
export class ModalPlayKingdomReclassComponent {
  public isVisible = computed(() => modalIsOpen('reclass-heroes'));
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

  public goldItemId = goldCoinId();

  public totalReclassCost = computed(() =>
    sum(
      this.picksModel().map((pick, index) => {
        const character = this.party()[index];
        if (!character || pick.jobId === character.jobId) return 0;
        return characterReclassCost(character, pick.jobId);
      }),
    ),
  );

  public canAffordReclass = computed(() => hasGold(this.totalReclassCost()));

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

    const picks = this.picksModel()
      .map((pick, index) => {
        const character = party[index];
        if (!character || pick.jobId === character.jobId) return undefined;
        return { characterId: character.id, jobId: pick.jobId };
      })
      .filter((pick): pick is CharacterReclassPick => !!pick);

    charactersReclass(picks);
  }

  public jobLevelForHero(hero: Character, job: JobId): number {
    return characterJobLevel(hero, job);
  }
}
