import { DestroyRef, inject, Injectable } from '@angular/core';
import { FF_DIRECTIONS } from '@ff/input/ff-action-map';
import { FFInputService } from '@ff/input/ff-input.service';
import { ffNearestInDirection } from '@ff/input/ff-spatial-nav';
import { FF_BUTTON_FEEDBACK } from '@ff/input/ff-tokens';
import type {
  FFDirection,
  FFFocusEdgeDetail,
  FFFocusScopeRegistration,
} from '@ff/interfaces/ff-input';
import { sortBy } from 'es-toolkit/compat';

export const FF_FOCUS_EDGE_EVENT = 'ffFocusEdge';

// Below every app handler, so anything that claims a direction or confirm wins.
const FOCUS_PRIORITY = -100;

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function isActive(element: HTMLElement): boolean {
  return (
    element.isConnected &&
    element.checkVisibility({ visibilityProperty: true }) &&
    !element.closest('[inert]')
  );
}

function hasSize(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

@Injectable({ providedIn: 'root' })
export class FFFocusService {
  private readonly input = inject(FFInputService);
  private readonly feedback = inject(FF_BUTTON_FEEDBACK, { optional: true });

  private scopes: FFFocusScopeRegistration[] = [];
  private memoryRoots: HTMLElement[] = [];
  private remembered = new WeakMap<HTMLElement, HTMLElement>();
  private openers = new WeakMap<HTMLElement, HTMLElement>();
  private activeScope?: HTMLElement;
  private activeRoot?: HTMLElement;
  private nextOrder = 0;

  constructor() {
    const unregisters = [
      ...FF_DIRECTIONS.map((direction) =>
        this.input.register(direction, () => this.move(direction), {
          priority: FOCUS_PRIORITY,
        }),
      ),
      this.input.register('confirm', () => this.focusedInScope()?.click(), {
        priority: FOCUS_PRIORITY,
        enabled: () => !!this.focusedInScope(),
        label: 'Select',
      }),
      this.input.onRefresh(() => this.syncScope()),
    ];
    document.addEventListener('focusin', this.remember);

    inject(DestroyRef).onDestroy(() => {
      unregisters.forEach((unregister) => unregister());
      document.removeEventListener('focusin', this.remember);
    });
  }

  public registerScope(
    priority: number,
    resolve: () => HTMLElement | null,
  ): () => void {
    const scope = { priority, resolve, order: this.nextOrder++ };
    this.scopes = [...this.scopes, scope];
    return () => {
      this.scopes = this.scopes.filter((existing) => existing !== scope);
    };
  }

  public registerMemoryRoot(root: HTMLElement): () => void {
    this.memoryRoots = [...this.memoryRoots, root];
    return () => {
      this.memoryRoots = this.memoryRoots.filter(
        (existing) => existing !== root,
      );
    };
  }

  public focusElement(element: HTMLElement): void {
    if (this.input.mode() === 'gamepad') this.focus(element);
  }

  public focusEdgeOf(container: HTMLElement, edge: 'first' | 'last'): void {
    const focusables = this.focusables(container);
    const target = edge === 'first' ? focusables[0] : focusables.at(-1);
    if (target) this.focus(target);
  }

  private topScope(): HTMLElement {
    const visible = this.scopes.flatMap((scope) => {
      const element = scope.resolve();
      return element && isActive(element) ? [{ scope, element }] : [];
    });
    const top = sortBy(visible, [
      ({ scope }) => -scope.priority,
      ({ scope }) => -scope.order,
    ])[0];
    return top?.element ?? document.body;
  }

  private focusables(container: HTMLElement): HTMLElement[] {
    return [
      ...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ].filter((element) => isActive(element) && hasSize(element));
  }

  private focusedIn(scope: HTMLElement): HTMLElement | undefined {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || active === document.body) {
      return undefined;
    }
    return scope.contains(active) && isActive(active) ? active : undefined;
  }

  private focusedInScope(): HTMLElement | undefined {
    return this.focusedIn(this.topScope());
  }

  private activeRootIn(scope: HTMLElement): HTMLElement | undefined {
    return this.memoryRoots
      .filter((root) => scope.contains(root) && isActive(root))
      .at(-1);
  }

  private move(direction: FFDirection): void {
    const scope = this.topScope();
    const current = this.focusedIn(scope);
    if (!current) {
      this.focusInitial(scope);
      return;
    }

    const candidates = this.focusables(scope).filter((el) => el !== current);
    const index = ffNearestInDirection(
      current.getBoundingClientRect(),
      candidates.map((candidate) => candidate.getBoundingClientRect()),
      direction,
    );
    if (index !== -1) {
      this.focus(candidates[index]);
      return;
    }

    current.dispatchEvent(
      new CustomEvent<FFFocusEdgeDetail>(FF_FOCUS_EDGE_EVENT, {
        bubbles: true,
        detail: { direction },
      }),
    );
  }

  private focusInitial(scope: HTMLElement): void {
    const root = this.activeRootIn(scope);
    const remembered = root ? this.remembered.get(root) : undefined;
    const target =
      remembered && isActive(remembered) && scope.contains(remembered)
        ? remembered
        : (this.focusables(root ?? scope)[0] ?? this.focusables(scope)[0]);
    if (target) this.focus(target);
  }

  private focus(element: HTMLElement): void {
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    this.feedback?.hover(0);
  }

  private remember = (event: FocusEvent): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    this.memoryRoots
      .filter((root) => root.contains(target))
      .forEach((root) => this.remembered.set(root, target));
  };

  // Opening a scope remembers what had focus, closing one hands it back; an unfocused scope gets its remembered/first element.
  private syncScope(): void {
    const scope = this.topScope();
    const root = this.activeRootIn(scope);
    const previous = this.activeScope;
    const changed = scope !== previous || root !== this.activeRoot;
    this.activeScope = scope;
    this.activeRoot = root;

    if (previous && scope !== previous) {
      if (isActive(previous)) this.rememberOpener(scope);
      else if (this.restoreOpener(previous, scope)) return;
    }
    if (changed || !this.focusedIn(scope)) this.focusInitial(scope);
  }

  private rememberOpener(scope: HTMLElement): void {
    const active = document.activeElement;
    if (active instanceof HTMLElement) this.openers.set(scope, active);
  }

  private restoreOpener(closed: HTMLElement, scope: HTMLElement): boolean {
    const opener = this.openers.get(closed);
    if (!opener || !isActive(opener) || !scope.contains(opener)) return false;

    this.focus(opener);
    return true;
  }
}
