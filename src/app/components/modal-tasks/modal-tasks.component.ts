import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { CurrencyCostComponent } from '@components/currency-cost/currency-cost';
import { IconComponent } from '@components/icon/icon.component';
import { ModalComponent } from '@components/modal/modal.component';
import { SFXDirective } from '@directives/sfx.directive';
import { tasksClaim } from '@helpers/task/task-claim.ui';
import { taskRowViewModels, tasksClaimableIds } from '@helpers/task/task.ui';
import type { TaskId } from '@interfaces';

@Component({
  selector: 'app-modal-tasks',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyCostComponent,
    DecimalPipe,
    IconComponent,
    ModalComponent,
    SFXDirective,
  ],
  templateUrl: './modal-tasks.component.html',
})
export class ModalTasksComponent {
  public rows = computed(() => taskRowViewModels());
  public claimableTaskIds = computed(() => tasksClaimableIds());

  public claim(taskIds: TaskId[]): void {
    void tasksClaim(taskIds);
  }
}
