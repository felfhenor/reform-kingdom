import { Directive } from '@angular/core';
import { modalCloseTop } from '@helpers/modal-stack';

@Directive({
  selector: '[appModalClose]',
  host: {
    '(click)': 'modalCloseTop()',
  },
})
export class ModalCloseDirective {
  protected readonly modalCloseTop = modalCloseTop;
}
