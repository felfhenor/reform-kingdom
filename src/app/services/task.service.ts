import { Injectable } from '@angular/core';

import { tasksAnnounceCompleted } from '@helpers/task/task-complete.ui';
import { tasksCompleted$ } from '@helpers/task/task-completed';

@Injectable({
  providedIn: 'root',
})
export class TaskService {
  init() {
    tasksCompleted$.subscribe((tasks) => tasksAnnounceCompleted(tasks));
  }
}
