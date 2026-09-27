import { CdkDrag } from '@angular/cdk/drag-drop';
import { DestroyRef, Directive, inject } from '@angular/core';
import { ListReflowDirective } from '@directives/list-reflow.directive';

// Goes on each `cdkDrag` row of a list that has `appListReflow`, so a drag reorder is left to CDK.
@Directive({
  selector: '[appListReflowDrag]',
})
export class ListReflowDragDirective {
  constructor() {
    const drag = inject(CdkDrag);
    const reflow = inject(ListReflowDirective);
    const subscriptions = [
      drag.started.subscribe(() => reflow.hold()),
      drag.ended.subscribe(() => reflow.release()),
    ];

    inject(DestroyRef).onDestroy(() =>
      subscriptions.forEach((subscription) => subscription.unsubscribe()),
    );
  }
}
