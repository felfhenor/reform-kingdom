import { DestroyRef, inject, Injectable } from '@angular/core';
import { FF_DIRECTIONS } from '@ff/input/ff-action-map';
import { FFInputService } from '@ff/input/ff-input.service';
import { ffNearestInDirection, ffNearestTo } from '@ff/input/ff-spatial-nav';
import { FF_BUTTON_FEEDBACK } from '@ff/input/ff-tokens';
import type {
  FFDirection,
  FFRect,
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

// Where focus lands when there's nothing remembered: the current section or selected tab, if any.
const CURRENT_SELECTOR =
  '[aria-current]:not([aria-current="false"]), [aria-selected="true"]';

function isActive(element: HTMLElement): boolean {
  return (
    element.isConnected &&
    element.checkVisibility({ visibilityProperty: true }) &&
    !element.closest('[inert]')
  );
}

function isFocusable(element: HTMLElement): boolean {
  return element.matches(FOCUSABLE_SELECTOR) && isActive(element);
}

// Some controls focus a hidden inner element (a non-searchable ng-select's zero-width input); measure the control instead.
function rectOf(element: HTMLElement): DOMRect {
  return (element.closest('.ff-focus-host') ?? element).getBoundingClientRect();
}

function hasSize(element: HTMLElement): boolean {
  const rect = rectOf(element);
  return rect.width > 0 && rect.height > 0;
}

@Injectable({ providedIn: 'root' })
export class FFFocusService {
  private readonly input = inject(FFInputService);
  private readonly feedback = inject(FF_BUTTON_FEEDBACK, { optional: true });

  private scopes: FFFocusScopeRegistration[] = [];
  private memoryRoots: HTMLElement[] = [];
  private remembered = new WeakMap<HTMLElement, HTMLElement>();
  private rememberedRects = new WeakMap<HTMLElement, FFRect>();
  private openers = new WeakMap<HTMLElement, HTMLElement>();
  private activeScope?: HTMLElement;
  private activeRoot?: HTMLElement;
  private nextOrder = 0;
  private focusOnChangeHeld = false;
  private nextFrameId?: number;

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
      this.input.setElementFilter((element) =>
        this.topScope().contains(element),
      ),
    ];
    document.addEventListener('focusin', this.remember);

    inject(DestroyRef).onDestroy(() => {
      unregisters.forEach((unregister) => unregister());
      document.removeEventListener('focusin', this.remember);
      if (this.nextFrameId !== undefined)
        cancelAnimationFrame(this.nextFrameId);
    });
  }

  // autoFocus false: nothing gets focus in the scope until the player moves it there (e.g. a map that owns the D-pad).
  public registerScope(
    priority: number,
    resolve: () => HTMLElement | null,
    autoFocus = true,
  ): () => void {
    const scope = { priority, resolve, autoFocus, order: this.nextOrder++ };
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

  // The container's current/selected entry, else its first; false when it has nothing to focus yet.
  public focusLanding(container: HTMLElement): boolean {
    const target = this.landingIn(container);
    if (!target) return false;

    this.focus(target);
    return true;
  }

  public hasLanding(container: HTMLElement): boolean {
    return !!this.landingIn(container);
  }

  // Lets a caller that places focus itself (e.g. LT/RT hero cycling) stop ffFocusOnChange lists grabbing it.
  public holdFocusOnChange(): void {
    this.focusOnChangeHeld = true;
  }

  public releaseFocusOnChange(): void {
    this.focusOnChangeHeld = false;
  }

  public isFocusOnChangeHeld(): boolean {
    return this.focusOnChangeHeld;
  }

  // For callers whose own element may be destroyed by the change they just made (e.g. a re-rendered tablist).
  public focusNextFrame(find: () => HTMLElement | undefined): void {
    if (this.nextFrameId !== undefined) cancelAnimationFrame(this.nextFrameId);
    this.nextFrameId = requestAnimationFrame(() => {
      this.nextFrameId = undefined;
      const target = find();
      if (target) this.focusElement(target);
    });
  }

  public isFocusable(element: HTMLElement): boolean {
    return isFocusable(element);
  }

  public focusEdgeOf(container: HTMLElement, edge: 'first' | 'last'): void {
    const focusables = this.focusables(container);
    const target = edge === 'first' ? focusables[0] : focusables.at(-1);
    if (target) this.focus(target);
  }

  private topScope(): HTMLElement {
    return this.topScopeEntry()?.element ?? document.body;
  }

  private topScopeEntry() {
    const visible = this.scopes.flatMap((scope) => {
      const element = scope.resolve();
      return element && isActive(element) ? [{ scope, element }] : [];
    });
    return sortBy(visible, [
      ({ scope }) => -scope.priority,
      ({ scope }) => -scope.order,
    ])[0];
  }

  private focusables(container: HTMLElement): HTMLElement[] {
    return [
      ...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ].filter(
      (element) =>
        isActive(element) &&
        hasSize(element) &&
        !element.closest('.ff-focus-skip') &&
        !element.parentElement?.closest('.ff-focus-row'),
    );
  }

  private focusedIn(scope: HTMLElement): HTMLElement | undefined {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || active === document.body) {
      return undefined;
    }
    return scope.contains(active) && isFocusable(active) ? active : undefined;
  }

  private focusedInScope(): HTMLElement | undefined {
    return this.focusedIn(this.topScope());
  }

  private activeRootIn(scope: HTMLElement): HTMLElement | undefined {
    return this.memoryRoots
      .filter((root) => scope.contains(root) && isActive(root))
      .at(-1);
  }

  // Inside a zone (e.g. a paged grid), its own edge gets first say before focus leaves it.
  private move(direction: FFDirection): void {
    const scope = this.topScope();
    const current = this.focusedIn(scope);
    if (!current) {
      this.focusInitial(scope);
      return;
    }

    const zone = current.closest<HTMLElement>('.ff-focus-zone');
    if (zone && scope.contains(zone)) {
      if (this.focusNearest(current, zone, direction)) return;
      if (this.dispatchEdge(current, direction)) return;
    }

    if (this.focusNearest(current, scope, direction)) return;
    if (!zone) this.dispatchEdge(current, direction);
  }

  private focusNearest(
    current: HTMLElement,
    container: HTMLElement,
    direction: FFDirection,
  ): boolean {
    const candidates = this.focusables(container).filter(
      (el) => el !== current,
    );
    const index = ffNearestInDirection(
      rectOf(current),
      candidates.map((candidate) => rectOf(candidate)),
      direction,
    );
    if (index === -1) return false;

    this.focus(candidates[index]);
    return true;
  }

  // True when a listener handled the edge (by cancelling the event).
  private dispatchEdge(current: HTMLElement, direction: FFDirection): boolean {
    return !current.dispatchEvent(
      new CustomEvent<FFFocusEdgeDetail>(FF_FOCUS_EDGE_EVENT, {
        bubbles: true,
        cancelable: true,
        detail: { direction },
      }),
    );
  }

  private focusInitial(scope: HTMLElement): void {
    const root = this.activeRootIn(scope);
    const remembered = root ? this.remembered.get(root) : undefined;
    const lastRect = root ? this.rememberedRects.get(root) : undefined;
    const target =
      remembered && isFocusable(remembered) && scope.contains(remembered)
        ? remembered
        : (this.landingIn(root ?? scope, lastRect) ??
          this.landingIn(scope, lastRect));
    if (target) this.focus(target);
  }

  // Prefers a "current" element (selected row, active section), nearest to where focus was lost if known.
  private landingIn(
    container: HTMLElement,
    lastRect?: FFRect,
  ): HTMLElement | undefined {
    const focusables = this.focusables(container);
    const currents = focusables.filter((el) => el.matches(CURRENT_SELECTOR));
    const pool = currents.length > 0 ? currents : focusables;
    if (!lastRect) return pool[0];

    const index = ffNearestTo(
      lastRect,
      pool.map((element) => rectOf(element)),
    );
    return pool[index];
  }

  // Only reacts when focus actually lands, so a refused focus (e.g. a just-disabled button) can't retry-click every refresh.
  private focus(element: HTMLElement): void {
    if (document.activeElement === element) return;

    element.focus({ preventScroll: true });
    if (document.activeElement !== element) return;

    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    this.feedback?.hover(0);
  }

  private remember = (event: FocusEvent): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const rect = rectOf(target);
    this.memoryRoots
      .filter((root) => root.contains(target))
      .forEach((root) => {
        this.remembered.set(root, target);
        this.rememberedRects.set(root, rect);
      });
  };

  // Opening a scope remembers what had focus, closing one hands it back; an unfocused scope gets its remembered/first element.
  private syncScope(): void {
    const entry = this.topScopeEntry();
    const scope = entry?.element ?? document.body;
    const root = this.activeRootIn(scope);
    const previous = this.activeScope;
    const changed = scope !== previous || root !== this.activeRoot;
    this.activeScope = scope;
    this.activeRoot = root;

    if (previous && scope !== previous) {
      if (isActive(previous)) this.rememberOpener(scope);
      else if (this.restoreOpener(previous, scope)) return;
    }
    if (entry?.scope.autoFocus === false) return;
    if (changed || !this.focusedIn(scope)) this.focusInitial(scope);
  }

  private rememberOpener(scope: HTMLElement): void {
    const active = document.activeElement;
    if (active instanceof HTMLElement) this.openers.set(scope, active);
  }

  private restoreOpener(closed: HTMLElement, scope: HTMLElement): boolean {
    const opener = this.openers.get(closed);
    if (!opener || !isFocusable(opener) || !scope.contains(opener)) {
      return false;
    }

    this.focus(opener);
    return true;
  }
}
