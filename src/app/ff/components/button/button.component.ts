import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import { FFInputPromptComponent } from '@ff/components/input-prompt/input-prompt.component';
import { ffHotkeyMatches } from '@ff/input/ff-hotkeys';
import { FFInputService } from '@ff/input/ff-input.service';
import { FF_BUTTON_FEEDBACK } from '@ff/input/ff-tokens';
import type { FFGamepadAction, FFPromptLabel } from '@ff/interfaces/ff-input';
import { HotkeysService } from '@ngneat/hotkeys';

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector -- an attribute selector keeps native <button> semantics
  selector: 'button[ffButton]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FFInputPromptComponent],
  host: {
    '(click)': 'onClick()',
    '(mouseenter)': 'onHover()',
  },
  template: `
    @if (ffPadAction(); as action) {
      <ff-input-prompt [action]="action" />
    }
    <ng-content />
  `,
})
export class FFButtonComponent {
  private readonly host =
    inject<ElementRef<HTMLButtonElement>>(ElementRef).nativeElement;
  private readonly feedback = inject(FF_BUTTON_FEEDBACK, { optional: true });
  private readonly hotkeys = inject(HotkeysService);
  private readonly inputService = inject(FFInputService);

  public ffButton = input<string>('');
  public ffSoundOffset = input<number>(0);
  public ffHotkey = input<string>();
  public ffHotkeyPreventDefault = input<boolean>(true);
  public ffPadAction = input<FFGamepadAction>();
  public ffPadPriority = input<number>(0);
  public ffPadLabel = input<FFPromptLabel>();
  public ffPadEnabled = input<boolean>(true);

  constructor() {
    effect((onCleanup) => {
      const keys = this.ffHotkey();
      if (!keys) return;

      const subscription = this.hotkeys
        .addShortcut({
          keys,
          global: true,
          preventDefault: this.ffHotkeyPreventDefault(),
        })
        // A duplicate shortcut emits null instead of erroring.
        .subscribe((event) => {
          if (event && ffHotkeyMatches(event, keys)) this.host.click();
        });
      onCleanup(() => subscription.unsubscribe());
    });

    effect((onCleanup) => {
      const action = this.ffPadAction();
      if (!action) return;

      const unregister = this.inputService.register(
        action,
        () => this.host.click(),
        {
          element: this.host,
          priority: this.ffPadPriority(),
          enabled: () => this.ffPadEnabled() && !this.host.disabled,
          label: () => this.padLabel(),
        },
      );
      onCleanup(unregister);
    });
  }

  protected onClick(): void {
    this.feedback?.click(this.ffButton(), this.ffSoundOffset());
  }

  protected onHover(): void {
    this.feedback?.hover(this.ffSoundOffset());
  }

  private padLabel(): string {
    const label = this.ffPadLabel();
    return typeof label === 'function' ? label() : (label ?? '');
  }
}
