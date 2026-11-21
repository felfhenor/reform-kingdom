import {
  contentChildren,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  forwardRef,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FFReorderItemDirective } from '@ff/controls/ff-reorder-item.directive';
import { FFFocusService } from '@ff/focus/ff-focus.service';
import { FFInputService } from '@ff/input/ff-input.service';
import type {
  FFGamepadAction,
  FFReorderGrab,
  FFReorderMove,
} from '@ff/interfaces/ff-input';
import { clamp } from 'es-toolkit/compat';

const BLOCKED_ACTIONS: FFGamepadAction[] = [
  'left',
  'right',
  'tabPrev',
  'tabNext',
  'subPrev',
  'subNext',
  'context',
  'details',
  'pause',
  'menu',
  'recenter',
];

// Controller grab mode for a drag-sortable list: X on a row picks it up, the D-pad moves it, A drops, B puts it back.
@Directive({
  selector: '[ffReorderList]',
  host: { '(focusout)': 'onFocusOut($event)' },
})
export class FFReorderListDirective {
  private readonly ffInput = inject(FFInputService);
  private readonly focus = inject(FFFocusService);
  private readonly host =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly items = contentChildren(
    forwardRef(() => FFReorderItemDirective),
    { descendants: true },
  );

  // Must outrank whatever the list sits in (e.g. a modal's B close).
  public ffReorderPriority = input<number>(0);
  // Rows above this index (e.g. pinned ones) can't be moved into.
  public ffReorderMin = input<number>(0);
  public ffReorderList = output<FFReorderMove>();

  public readonly grab = signal<FFReorderGrab | undefined>(undefined);

  constructor() {
    effect((onCleanup) => {
      const unregisters = this.registerGrabActions(this.ffReorderPriority());
      onCleanup(() => unregisters.forEach((unregister) => unregister()));
    });
    // Mouse or keyboard use mid-grab keeps the order as it stands.
    effect(() => {
      if (this.ffInput.mode() !== 'gamepad') untracked(() => this.drop());
    });
    inject(DestroyRef).onDestroy(() => this.grab.set(undefined));
  }

  // Something else taking focus (a tutorial, a dialog) ends the grab; a null target is just the moved row re-rendering.
  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget;
    if (next instanceof Node && !this.host.contains(next)) this.drop();
  }

  public pickUp(item: FFReorderItemDirective): void {
    const from = this.items().indexOf(item);
    if (from === -1) return;

    const focused = (document.activeElement as HTMLElement | null) ?? undefined;
    this.grab.set({ item, from, at: from, focused });
  }

  private registerGrabActions(priority: number): (() => void)[] {
    const enabled = () => !!this.grab();
    const options = { priority, enabled };
    return [
      this.ffInput.register('up', () => this.move(-1), {
        ...options,
        label: 'Move',
      }),
      this.ffInput.register('down', () => this.move(1), {
        ...options,
        label: 'Move',
      }),
      this.ffInput.register('confirm', () => this.drop(), {
        ...options,
        label: 'Drop',
      }),
      this.ffInput.register('back', () => this.cancel(), {
        ...options,
        label: 'Cancel',
      }),
      ...BLOCKED_ACTIONS.map((action) =>
        this.ffInput.register(action, () => undefined, options),
      ),
    ];
  }

  private move(direction: 1 | -1): void {
    const grab = this.grab();
    if (!grab) return;

    const last = this.items().length - 1;
    const to = clamp(grab.at + direction, this.ffReorderMin(), last);
    this.moveTo(grab, to);
  }

  private moveTo(grab: FFReorderGrab, to: number): void {
    if (to === grab.at) return;

    this.ffReorderList.emit({ fromIndex: grab.at, toIndex: to });
    this.grab.set({ ...grab, at: to });
    // Re-rendering the moved row can drop focus, so it's put back on the same control.
    this.focus.focusNextFrame(() => grab.focused);
  }

  private drop(): void {
    this.grab.set(undefined);
  }

  private cancel(): void {
    const grab = this.grab();
    if (!grab) return;

    this.moveTo(grab, grab.from);
    this.grab.set(undefined);
  }
}
