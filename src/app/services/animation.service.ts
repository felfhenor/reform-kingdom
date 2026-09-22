import { formatNumber } from '@angular/common';
import {
  effect,
  inject,
  Injectable,
  LOCALE_ID,
  signal,
  untracked,
  type Signal,
} from '@angular/core';
import { animate, type DOMTarget, type JSAnimation } from 'animejs';

@Injectable({
  providedIn: 'root',
})
export class AnimationService {
  private locale = inject(LOCALE_ID);

  popIn(target: Element): JSAnimation {
    return animate(target as DOMTarget, {
      opacity: [0, 0.85],
      scale: [0.8, 1],
      duration: 220,
      ease: 'outBack',
    });
  }

  fadeOut(target: Element): JSAnimation {
    return animate(target as DOMTarget, {
      opacity: [1, 0],
      duration: 250,
      ease: 'inQuad',
    });
  }

  slideIn(target: Element): JSAnimation {
    return animate(target as DOMTarget, {
      opacity: [0, 1],
      translateY: [-8, 0],
      duration: 220,
      ease: 'outQuad',
    });
  }

  tweenNumber(
    from: number,
    to: number,
    onUpdate: (value: number) => void,
  ): JSAnimation {
    const target = { value: from };
    return animate(target, {
      value: to,
      duration: 400,
      ease: 'outQuad',
      onUpdate: () => onUpdate(target.value),
    });
  }

  // Spawns a temporary "+N"/"-N" span inside `container` that floats up and fades out, then removes itself.
  floatDelta(container: Element, delta: number): JSAnimation {
    const sign = delta > 0 ? '+' : '-';
    const formatted = formatNumber(Math.abs(delta), this.locale, '1.0-0');
    const colorClass = delta > 0 ? 'text-success' : 'text-error';

    const span = document.createElement('span');
    span.textContent = `${sign}${formatted}`;
    span.className = `absolute left-1/2 -top-1 -translate-x-1/2 text-xs font-bold pointer-events-none whitespace-nowrap ${colorClass}`;
    container.appendChild(span);

    const anim = animate(span, {
      opacity: [1, 0],
      translateY: [0, -16],
      duration: 900,
      ease: 'outQuad',
    });
    anim.then(() => span.remove());
    return anim;
  }
}

// Snaps to `source()` on first read, tweens to it on every change after, and cancels
// an in-flight tween before starting the next so a rapid re-trigger can't race it.
// Must be called from an injection context (a field initializer or constructor).
export function injectTweenedNumber(source: () => number): Signal<number> {
  const anim = inject(AnimationService);
  const display = signal(0);
  let hasInitialized = false;
  let currentTween: JSAnimation | undefined;

  effect(() => {
    const target = source();
    untracked(() => {
      if (!hasInitialized) {
        hasInitialized = true;
        display.set(target);
        return;
      }
      currentTween?.pause();
      currentTween = anim.tweenNumber(display(), target, (v) => display.set(v));
    });
  });

  return display.asReadonly();
}
