import { Directive } from '@angular/core';

// Keeps controller focus out of a region whose actions all have their own buttons (e.g. the navbar's LB/RB/Start/View).
@Directive({
  selector: '[ffFocusSkip]',
  host: { class: 'ff-focus-skip' },
})
export class FFFocusSkipDirective {}
