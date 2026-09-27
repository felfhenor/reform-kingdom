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
    let isDragging = false;
    const subscriptions = [
      drag.started.subscribe(() => {
        isDragging = true;
        reflow.hold();
      }),
      drag.ended.subscribe(() => {
        isDragging = false;
        reflow.release();
      }),
    ];

    // CDK never emits `ended` for a row destroyed mid-drag, which would leave the list held for good.
    inject(DestroyRef).onDestroy(() => {
      subscriptions.forEach((subscription) => subscription.unsubscribe());
      if (isDragging) reflow.release();
    });
  }
}
