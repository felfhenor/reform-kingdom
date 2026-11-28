import { t } from '@helpers/i18n/i18n';
import { NgTemplateOutlet } from '@angular/common';
import type { ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { FFButtonComponent } from '@ff/components/button/button.component';
import { ffGroupSelectOptions } from '@ff/controls/ff-select-groups';
import { FFSelectPopupService } from '@ff/controls/ff-select-popup.service';
import { FFFocusScopeDirective } from '@ff/focus/ff-focus-scope.directive';
import { FFFocusService } from '@ff/focus/ff-focus.service';
import { FFInputService } from '@ff/input/ff-input.service';
import type { FFGamepadAction } from '@ff/interfaces/ff-input';
import type { NgOption } from '@ng-select/ng-select';
import { clamp } from 'es-toolkit/compat';

const PAGE_SIZE = 6;
// Page-level bindings that must not act behind the open popup.
const BLOCKED_ACTIONS: FFGamepadAction[] = [
  'tabPrev',
  'tabNext',
  'pause',
  'menu',
  'recenter',
  'context',
  'details',
];

@Component({
  selector: 'ff-select-popup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, FFButtonComponent, FFFocusScopeDirective],
  template: `
    @if (popup.request(); as request) {
      <div
        class="fixed inset-0 z-[1050] flex items-center justify-center bg-black/50"
        (click)="cancel()"
      >
        <div
          class="bg-base-100 border border-base-300 shadow-xl p-4 w-[min(90vw,720px)] max-h-[80vh] overflow-y-auto overflow-x-hidden"
          [ffFocusScope]="priority()"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-center justify-between gap-2 mb-3">
            <span
              class="type-page-title"
              [textContent]="request.title ?? ''"
            ></span>
            <!-- The app projects its own close button, so this matches every other modal. -->
            <ng-content select="[close]" />
          </div>

          <!-- One column, so long names and badges always have room; rows in a group share a height. -->
          <div #list class="flex flex-col gap-3">
            @if (request.clear; as clear) {
              <button
                type="button"
                class="ff-select-tile btn btn-neutral h-auto min-h-10 min-w-0 py-2 justify-start text-left normal-case font-normal italic"
                (click)="clearValue(clear.run)"
                ffButton="ui-click"
              >
                <span [textContent]="clear.label"></span>
              </button>
            }
            @for (group of groups(); track $index) {
              <div class="flex flex-col gap-2">
                @if (group.header; as header) {
                  <div class="type-label">
                    @if (request.optgroupTemplate) {
                      <ng-container
                        [ngTemplateOutlet]="request.optgroupTemplate"
                        [ngTemplateOutletContext]="{
                          item: header.value,
                          item$: header,
                          index: $index,
                        }"
                      />
                    } @else {
                      <span [textContent]="header.label"></span>
                    }
                  </div>
                }

                <div class="grid grid-cols-1 auto-rows-fr gap-2">
                  @for (option of group.items; track $index) {
                    <button
                      type="button"
                      class="ff-select-tile btn btn-neutral h-auto min-h-10 min-w-0 py-2 justify-start text-left normal-case font-normal"
                      [attr.aria-selected]="!!option.selected"
                      [disabled]="option.disabled"
                      (click)="pick(option)"
                      ffButton="ui-click"
                    >
                      <!-- A column, like ng-select's own dropdown rows, so multi-block templates stack. -->
                      <div class="flex flex-col items-stretch min-w-0 w-full">
                        @if (request.optionTemplate) {
                          <ng-container
                            [ngTemplateOutlet]="request.optionTemplate"
                            [ngTemplateOutletContext]="{
                              item: option.value,
                              item$: option,
                              index: $index,
                              searchTerm: '',
                            }"
                          />
                        } @else {
                          <span [textContent]="option.label"></span>
                        }
                      </div>
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class FFSelectPopupComponent {
  protected readonly popup = inject(FFSelectPopupService);
  private readonly focus = inject(FFFocusService);
  private readonly ffInput = inject(FFInputService);
  private readonly list = viewChild<ElementRef<HTMLElement>>('list');

  protected groups = computed(() =>
    ffGroupSelectOptions(this.popup.request()?.options ?? []),
  );

  // Must outrank modal-close so B cancels the popup before closing a modal it sits over.
  public priority = input<number>(0);

  constructor() {
    const isOpen = () => !!this.popup.request();
    // Inputs aren't set yet in the constructor, so the priority-dependent binding waits for them.
    effect((onCleanup) => {
      const priority = this.priority();
      const unregisters = [
        this.ffInput.register('back', () => this.cancel(), {
          priority,
          enabled: isOpen,
          label: t('gamepad.cancel'),
        }),
        // The list is one column, so left/right are free to page too (and repeat when held).
        this.ffInput.register('left', () => this.page(-1), {
          priority,
          enabled: isOpen,
          label: t('gamepad.page'),
        }),
        this.ffInput.register('right', () => this.page(1), {
          priority,
          enabled: isOpen,
          label: t('gamepad.page'),
        }),
        this.ffInput.register('subPrev', () => this.page(-1), {
          priority,
          enabled: isOpen,
          label: t('gamepad.page'),
        }),
        this.ffInput.register('subNext', () => this.page(1), {
          priority,
          enabled: isOpen,
          label: t('gamepad.page'),
        }),
        ...BLOCKED_ACTIONS.map((action) =>
          this.ffInput.register(action, () => undefined, {
            priority,
            enabled: isOpen,
          }),
        ),
      ];
      onCleanup(() => unregisters.forEach((unregister) => unregister()));
    });
  }

  protected pick(option: NgOption): void {
    const request = this.popup.request();
    this.popup.close();
    request?.pick(option);
  }

  protected clearValue(run: () => void): void {
    this.popup.close();
    run();
  }

  public cancel(): void {
    this.popup.close();
  }

  // Jumps focus a handful of rows at a time through long option lists.
  private page(direction: 1 | -1): void {
    const list = this.list()?.nativeElement;
    if (!list) return;

    const tiles = [
      ...list.querySelectorAll<HTMLButtonElement>('button:not([disabled])'),
    ];
    const current = tiles.indexOf(document.activeElement as HTMLButtonElement);
    const next = clamp(current + direction * PAGE_SIZE, 0, tiles.length - 1);
    if (tiles[next]) this.focus.focusElement(tiles[next]);
  }
}
