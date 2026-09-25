import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { IconJobComponent } from '@components/icon-job/icon-job.component';
import { ModalComponent } from '@components/modal/modal.component';
import { RowCurrencyCostComponent } from '@components/row-currency-cost/row-currency-cost.component';
import { RowTrainerTeachingComponent } from '@components/row-trainer-teaching/row-trainer-teaching.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { SFXDirective } from '@directives/sfx.directive';
import { getEntry } from '@helpers/content/content';
import { activeTrainerNode } from '@helpers/engine/ui';
import { worldPartyState } from '@helpers/state-game';
import { isPartyAtTrainer } from '@helpers/trainer/trainer';
import { trainerTeach, trainerVisitRows } from '@helpers/trainer/trainer.ui';
import { worldNodeTrainer } from '@helpers/world-node/world-nodes';
import type {
  Character,
  CharacterId,
  JobContent,
  TrainerTeachingRow,
} from '@interfaces';

@Component({
  selector: 'app-modal-trainer-visit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconJobComponent,
    ModalComponent,
    RowCurrencyCostComponent,
    RowTrainerTeachingComponent,
    SFXDirective,
    SlotIconBlankComponent,
    BlankSlateComponent,
  ],
  templateUrl: './modal-trainer-visit.component.html',
})
export class ModalTrainerVisitComponent {
  public trainer = computed(() => {
    const entry = activeTrainerNode();
    return entry ? worldNodeTrainer(entry) : undefined;
  });

  public party = computed(() => worldPartyState());

  private selectedCharacterId = signal<CharacterId | undefined>(undefined);

  public selectedCharacter = computed<Character | undefined>(
    () =>
      this.party().find((c) => c.id === this.selectedCharacterId()) ??
      this.party()[0],
  );

  public selectedJobName = computed(() => {
    const character = this.selectedCharacter();
    return (character && this.jobFor(character)?.name) ?? 'hero';
  });

  public isAtTrainer = computed(() => {
    const trainer = this.trainer();
    return !!trainer && isPartyAtTrainer(trainer.id);
  });

  public rows = computed<TrainerTeachingRow[]>(() => {
    const trainer = this.trainer();
    const character = this.selectedCharacter();
    return trainer && character ? trainerVisitRows(trainer, character) : [];
  });

  public jobFor(character: Character): JobContent | undefined {
    return getEntry<JobContent>(character.jobId);
  }

  public selectCharacter(character: Character): void {
    this.selectedCharacterId.set(character.id);
  }

  public canTrain(row: TrainerTeachingRow): boolean {
    return (
      this.isAtTrainer() && row.availability === 'Available' && row.canAfford
    );
  }

  public train(row: TrainerTeachingRow): void {
    const trainer = this.trainer();
    const character = this.selectedCharacter();
    if (!trainer || !character) return;

    trainerTeach(trainer, character.id, row.teaching.id);
  }
}
