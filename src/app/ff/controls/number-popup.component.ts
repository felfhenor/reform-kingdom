import { TPipe } from '@pipes/t.pipe';
import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { FFButtonComponent } from '@ff/components/button/button.component';
import { FFInputPromptComponent } from '@ff/components/input-prompt/input-prompt.component';
import { FFNumberPopupService } from '@ff/controls/ff-number-popup.service';
import { ffStepNumber } from '@ff/controls/ff-number-step';
import { FFFocusScopeDirective } from '@ff/focus/ff-focus-scope.directive';
import { FFInputService } from '@ff/input/ff-input.service';
import type { FFGamepadAction } from '@ff/interfaces/ff-input';

const ACCELERATE_AFTER_MS = 2000;
const FAST_STEPS = 10;
const BLOCKED_ACTIONS: FFGamepadAction[] = [
  'tabPrev',
  'tabNext',
  'up',
  'down',
  'pause',
  'menu',
  'recenter',
  'context',
  'details',
];

// Controller entry for number and range inputs: D-pad adjusts (accelerating when held), LT/RT jump by 10, A keeps, B reverts.
@Component({
  selector: 'ff-number-popup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TPipe,
    DecimalPipe,
    FFButtonComponent,
    FFInputPromptComponent,
    FFFocusScopeDirective,
  ],
  template: `
    @if (popup.request(); as request) {
      <div
        class="fixed inset-0 z-[1050] flex items-center justify-center bg-black/50"
        (click)="cancel()"
      >
        <div
          class="bg-base-100 border border-base-300 shadow-xl p-4 w-[min(90vw,420px)] flex flex-col gap-4"
          [ffFocusScope]="priority()"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-center justify-between gap-2">
            <span
              class="type-page-title"
              [textContent]="request.title ?? ''"
            ></span>
            <ng-content select="[close]" />
          </div>

          <div class="flex items-center justify-center gap-4">
            <ff-input-prompt action="left" />
            <span class="text-2xl tabular-nums min-w-24 text-center">
              {{ draft() | number: '1.0-2' }}
            </span>
            <ff-input-prompt action="right" />
          </div>

          @if (request.min !== undefined && request.max !== undefined) {
            <span class="type-meta text-center">
              {{ request.min | number: '1.0-2' }} –
              {{ request.max | number: '1.0-2' }}
            </span>
          }

          <button
            type="button"
            class="btn btn-primary"
            (click)="done()"
            ffButton="ui-success"
            ffPadAction="confirm"
            [ffPadPriority]="priority()"
            [ffPadLabel]="'numberPopup.done' | t"
          >
            {{ 'numberPopup.done' | t }}
          </button>
        </div>
      </div>
    }
  `,
})
export class FFNumberPopupComponent {
  protected readonly popup = inject(FFNumberPopupService);
  private readonly ffInput = inject(FFInputService);

  // Must outrank modal-close and page bindings, since the popup can open over either.
  public priority = input<number>(0);

  protected draft = linkedSignal(() => this.popup.request()?.value ?? 0);

  constructor() {
    const isOpen = () => !!this.popup.request();
    effect((onCleanup) => {
      const priority = this.priority();
      const options = { priority, enabled: isOpen };
      const unregisters = [
        this.ffInput.register('left', () => this.adjust(-1), {
          ...options,
          label: 'Adjust',
        }),
        this.ffInput.register('right', () => this.adjust(1), {
          ...options,
          label: 'Adjust',
        }),
        this.ffInput.register('subPrev', () => this.step(-FAST_STEPS), {
          ...options,
          label: '±10',
        }),
        this.ffInput.register('subNext', () => this.step(FAST_STEPS), {
          ...options,
          label: '±10',
        }),
        this.ffInput.register('back', () => this.cancel(), {
          ...options,
          label: 'Cancel',
        }),
        ...BLOCKED_ACTIONS.map((action) =>
          this.ffInput.register(action, () => undefined, options),
        ),
      ];
      onCleanup(() => unregisters.forEach((unregister) => unregister()));
    });
  }

  protected done(): void {
    const request = this.popup.request();
    const value = this.draft();
    this.popup.close();
    request?.commit(value);
  }

  public cancel(): void {
    this.popup.close();
  }

  private adjust(direction: 1 | -1): void {
    const held = this.ffInput.heldDirectionMs() >= ACCELERATE_AFTER_MS;
    this.step(direction * (held ? FAST_STEPS : 1));
  }

  private step(steps: number): void {
    const request = this.popup.request();
    if (!request) return;
    this.draft.update((value) => ffStepNumber(value, steps, request));
  }
}
