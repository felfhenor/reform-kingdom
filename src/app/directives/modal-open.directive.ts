import { Directive, input } from '@angular/core';
import { modalOpen } from '@helpers/modal-stack';
import type { ModalId } from '@interfaces';

@Directive({
  selector: '[appModalOpen]',
  host: {
    '(click)': 'open()',
  },
})
export class ModalOpenDirective {
  public appModalOpen = input.required<ModalId>();

  protected open(): void {
    modalOpen(this.appModalOpen());
  }
}
