import { NgClass } from '@angular/common';
import type { ElementRef } from '@angular/core';
import {
  Component,
  computed,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { ButtonCloseComponent } from '@components/button-close/button-close.component';
import { modalClose, modalIsOpen } from '@helpers/engine/modal-stack';
import type { ModalId } from '@interfaces';

@Component({
  selector: 'app-modal',
  imports: [ButtonCloseComponent, NgClass],
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.scss',
})
export class ModalComponent {
  public modalId = input.required<ModalId>();

  public allowEscToClose = input<boolean>(true);
  public closeOnBackdropClick = input<boolean>(false);
  public showCloseButton = input<boolean>(false);
  public widthClass = input<string>('max-w-3xl');

  public modalClose = output<void>();

  public modal = viewChild<ElementRef<HTMLDialogElement>>('modal');

  // Content stays mounted while closing (stack is the source of truth), so it doesn't tear down mid-transition.
  public isOpen = computed(() => modalIsOpen(this.modalId()));

  constructor() {
    effect(() => {
      if (!this.isOpen()) {
        this.modal()?.nativeElement.close();
        return;
      }

      this.modal()?.nativeElement.show();
    });
  }

  public closeModal() {
    modalClose(this.modalId());
    this.modalClose.emit();
  }

  public backdropClick(event: MouseEvent) {
    if (!this.closeOnBackdropClick()) return;
    if (event.target !== this.modal()?.nativeElement) return;

    this.closeModal();
  }
}
