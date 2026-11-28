import { t } from '@helpers/i18n/i18n';
import { TPipe } from '@pipes/t.pipe';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import { IconComponent } from '@components/icon/icon.component';
import { FFButtonComponent } from '@ff/components/button/button.component';
import { ffGamepadOn } from '@ff/input/ff-gamepad-on';
import { FFInputService } from '@ff/input/ff-input.service';
import { GAMEPAD_PRIORITY } from '@helpers/engine/gamepad.ui';
import { kingdomSubviewClear } from '@helpers/engine/ui';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-button-kingdom-back',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe, TippyDirective, FFButtonComponent, IconComponent],
  template: `
    <button
      class="btn btn-sm btn-neutral btn-outline text-neutral-content"
      [class.hidden]="isGamepadMode()"
      [tp]="'buttonKingdomBack.goBackBackspace' | t"
      (click)="back()"
      ffButton="ui-error"
      ffHotkey="BACKSPACE"
    >
      <app-icon name="tablerArrowLeft" class="text-lg" />
    </button>
  `,
})
export class ButtonKingdomBackComponent {
  // Subviews outside the Kingdom tab (e.g. the Heroes regalia page) pass their own exit.
  public onBack = input<() => void>(kingdomSubviewClear);

  private readonly ffInput = inject(FFInputService);
  protected isGamepadMode = computed(() => this.ffInput.mode() === 'gamepad');

  constructor() {
    // Bound to the host, which stays visible while the button itself is hidden in controller mode.
    ffGamepadOn('back', () => this.back(), {
      priority: GAMEPAD_PRIORITY.page,
      element: inject<ElementRef<HTMLElement>>(ElementRef).nativeElement,
      label: t('gamepad.back'),
    });
  }

  public back(): void {
    this.onBack()();
  }
}
