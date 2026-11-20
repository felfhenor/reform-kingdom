import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  signal,
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
      <!-- Row-scoped glyphs keep their space when hidden, so every row's button stays the same width. -->
      <ff-input-prompt
        [action]="action"
        [class.invisible]="!!ffPadWithin() && !withinFocused()"
      />
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
  // For per-row actions in a list: only the row holding controller focus answers the press.
  public ffPadWithin = input<HTMLElement>();

  // Focus isn't reactive, so the row's focusin/focusout drive whether its glyph shows.
  protected withinFocused = signal(false);

  constructor() {
    effect((onCleanup) => {
      const within = this.ffPadWithin();
      if (!within) return;

      const sync = () =>
        this.withinFocused.set(within.contains(document.activeElement));
      // focusout fires before focus lands elsewhere, so check on the next frame.
      let frameId: number | undefined;
      const onFocusOut = () => {
        if (frameId !== undefined) cancelAnimationFrame(frameId);
        frameId = requestAnimationFrame(sync);
      };
      within.addEventListener('focusin', sync);
      within.addEventListener('focusout', onFocusOut);
      onCleanup(() => {
        if (frameId !== undefined) cancelAnimationFrame(frameId);
        within.removeEventListener('focusin', sync);
        within.removeEventListener('focusout', onFocusOut);
      });
    });

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
          enabled: () =>
            this.ffPadEnabled() && !this.host.disabled && this.focusWithin(),
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

  private focusWithin(): boolean {
    const within = this.ffPadWithin();
    return !within || within.contains(document.activeElement);
  }

  private padLabel(): string {
    const label = this.ffPadLabel();
    return typeof label === 'function' ? label() : (label ?? '');
  }
}
