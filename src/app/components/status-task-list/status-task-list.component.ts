import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { IconComponent } from '@components/icon/icon.component';
import { SFXDirective } from '@directives/sfx.directive';
import { modalOpen } from '@helpers/engine/modal-stack';
import { tasksWidgetEntries } from '@helpers/task/task.ui';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-status-task-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, IconComponent, SFXDirective, TippyDirective],
  templateUrl: './status-task-list.component.html',
  styleUrl: './status-task-list.component.scss',
})
export class StatusTaskListComponent {
  public entries = computed(() => tasksWidgetEntries());

  public openTasks(): void {
    modalOpen('tasks');
  }
}
