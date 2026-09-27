import type { AnimationCallbackEvent } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { IconComponent } from '@components/icon/icon.component';
import { RowTaskStatusComponent } from '@components/row-task-status/row-task-status.component';
import { SFXDirective } from '@directives/sfx.directive';
import { modalOpen } from '@helpers/engine/modal-stack';
import { tasksWidgetEntries } from '@helpers/task/task.ui';
import { TippyDirective } from '@ngneat/helipopper';
import { AnimationService } from '@services/animation.service';

@Component({
  selector: 'app-status-task-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconComponent,
    RowTaskStatusComponent,
    SFXDirective,
    TippyDirective,
  ],
  templateUrl: './status-task-list.component.html',
  styleUrl: './status-task-list.component.scss',
})
export class StatusTaskListComponent {
  private anim = inject(AnimationService);

  public entries = computed(() => tasksWidgetEntries());

  public onRowEnter(event: AnimationCallbackEvent, index: number): void {
    this.anim.slideInSide(event.target, index);
  }

  public onRowLeave(event: AnimationCallbackEvent): void {
    this.anim
      .slideOutCollapse(event.target)
      .then(() => event.animationComplete())
      .catch(() => event.animationComplete());
  }

  public openTasks(): void {
    modalOpen('tasks');
  }
}
