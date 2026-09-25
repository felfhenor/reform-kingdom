import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  linkedSignal,
  untracked,
} from '@angular/core';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { IconJobComponent } from '@components/icon-job/icon-job.component';
import { ModalComponent } from '@components/modal/modal.component';
import { RowTrainerTeachingComponent } from '@components/row-trainer-teaching/row-trainer-teaching.component';
import { SFXDirective } from '@directives/sfx.directive';
import { heroTeachingsModalCharacterId } from '@helpers/engine/ui';
import { worldPartyState } from '@helpers/state-game';
import {
  characterTeachingJobTabs,
  characterTeachingRows,
} from '@helpers/trainer/trainer.ui';
import type { JobId, TrainerTeachingRow } from '@interfaces';
import { sumBy } from 'es-toolkit/compat';

@Component({
  selector: 'app-modal-hero-teachings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BlankSlateComponent,
    DecimalPipe,
    IconJobComponent,
    ModalComponent,
    RowTrainerTeachingComponent,
    SFXDirective,
  ],
  templateUrl: './modal-hero-teachings.component.html',
})
export class ModalHeroTeachingsComponent {
  public character = computed(() =>
    worldPartyState().find((c) => c.id === heroTeachingsModalCharacterId()),
  );

  // Keyed on primitives (and the computation untracked) so hp/xp/gear updates don't snap the tab back.
  private heroJobKey = computed(() => {
    const character = this.character();
    return character ? `${character.id}:${character.jobId}` : undefined;
  });

  // Resets to the hero's current job whenever a different hero (or job) is shown.
  public selectedJobId = linkedSignal<string | undefined, JobId | undefined>({
    source: this.heroJobKey,
    computation: () => untracked(() => this.character()?.jobId),
  });

  public tabs = computed(() => {
    const character = this.character();
    return character ? characterTeachingJobTabs(character) : [];
  });

  public selectedJob = computed(
    () => this.tabs().find((tab) => tab.job.id === this.selectedJobId())?.job,
  );

  public rows = computed<TrainerTeachingRow[]>(() => {
    const character = this.character();
    const jobId = this.selectedJobId();
    return character && jobId ? characterTeachingRows(character, jobId) : [];
  });

  public learnedTotal = computed(() =>
    sumBy(this.tabs(), (tab) => tab.learned),
  );
  public teachingTotal = computed(() => sumBy(this.tabs(), (tab) => tab.total));

  public selectJob(jobId: JobId): void {
    this.selectedJobId.set(jobId);
  }
}
