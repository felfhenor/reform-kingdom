import { formatNumber } from '@angular/common';
import {
  DestroyRef,
  effect,
  inject,
  Injectable,
  LOCALE_ID,
  signal,
  untracked,
  type Signal,
} from '@angular/core';
import type { DamageEventVariant } from '@interfaces';
import { animate, type DOMTarget, type JSAnimation } from 'animejs';

// hold: fraction of the lifetime spent fully opaque; rise: px travelled; tilt: total random rotation range in degrees.
const DAMAGE_NUMBER_PROFILES: Record<
  'normal' | 'heal' | DamageEventVariant,
  { hold: number; rise: number; tilt: number }
> = {
  normal: { hold: 0.45, rise: 24, tilt: 24 },
  heal: { hold: 0.45, rise: 30, tilt: 0 },
  critical: { hold: 0.6, rise: 29, tilt: 8 },
  miss: { hold: 0.3, rise: 8, tilt: 0 },
  block: { hold: 0.4, rise: 12, tilt: 0 },
  energy: { hold: 0.45, rise: 30, tilt: 0 },
  xp: { hold: 0.5, rise: 26, tilt: 0 },
};

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

  fadeOut(target: Element, duration = 250): JSAnimation {
    return animate(target as DOMTarget, {
      opacity: [1, 0],
      duration,
      ease: 'inQuad',
    });
  }

  // Slides in from the right edge, for widgets docked on that side; transform is cleared afterwards so it can't become a containing block.
  slideInSide(target: Element, index = 0): JSAnimation {
    const el = target as HTMLElement;
    el.style.opacity = '0';
    const anim = animate(el as DOMTarget, {
      opacity: [0, 1],
      translateX: [20, 0],
      duration: 240,
      delay: Math.min(index, 8) * 60,
      ease: 'outQuad',
    });
    anim.then(() => {
      el.style.removeProperty('opacity');
      el.style.removeProperty('transform');
    });
    return anim;
  }

  // Slides out then collapses the row's height (offsetting the parent's flex gap) so siblings close up instead of jumping.
  slideOutCollapse(target: Element): JSAnimation {
    const el = target as HTMLElement;
    const height = el.offsetHeight;
    const gap = parseFloat(getComputedStyle(el.parentElement!).rowGap) || 0;
    el.style.overflow = 'hidden';
    return animate(el as DOMTarget, {
      opacity: [1, 0],
      translateX: [0, 24],
      height: { from: height, to: 0, delay: 120, duration: 180 },
      marginBottom: { from: 0, to: -gap, delay: 120, duration: 180 },
      duration: 200,
      ease: 'inQuad',
    });
  }

  // Opacity only and cleared afterwards: a lingering transform would become the containing block for fixed descendants.
  // Opacity is zeroed up front so the target doesn't paint once at full opacity before the first frame.
  fadeIn(target: Element, duration = 300): JSAnimation {
    const el = target as HTMLElement;
    el.style.opacity = '0';
    const anim = animate(el as DOMTarget, {
      opacity: [0, 1],
      duration,
      ease: 'outQuad',
    });
    anim.then(() => el.style.removeProperty('opacity'));
    return anim;
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

  // Clones `source`'s visuals into a fixed-position ghost that flies to `target`'s
  // position, then removes itself and signals the "arrival" on `target`: `popIn` fades it up from
  // nothing, `pulse` bounces a target that is already visible.
  flyTo(
    source: Element,
    target: Element,
    arrival: 'popIn' | 'pulse' = 'popIn',
  ): JSAnimation {
    const from = source.getBoundingClientRect();
    const to = target.getBoundingClientRect();

    const ghost = source.cloneNode(true) as HTMLElement;
    ghost.style.position = 'fixed';
    ghost.style.left = `${from.left}px`;
    ghost.style.top = `${from.top}px`;
    ghost.style.width = `${from.width}px`;
    ghost.style.height = `${from.height}px`;
    ghost.style.margin = '0';
    ghost.style.zIndex = '9999';
    ghost.style.pointerEvents = 'none';
    document.body.appendChild(ghost);

    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);

    const anim = animate(ghost, {
      translateX: [0, dx],
      translateY: [0, dy],
      scale: [1, 0.5],
      opacity: [1, 0.7],
      duration: 500,
      ease: 'inOutQuad',
    });
    anim.then(() => {
      ghost.remove();
      this[arrival](target);
    });
    return anim;
  }

  // Bounces `target` without touching opacity - unlike popIn (which fades in from 0),
  // this is for drawing attention to an already-visible element that just changed.
  pulse(target: Element): JSAnimation {
    return animate(target as DOMTarget, {
      scale: [
        { to: 0.95, duration: 200, ease: 'outQuad' },
        { to: 1, duration: 250, ease: 'outBack' },
      ],
    });
  }

  // Confetti-style particle burst centered on `target`, plus a scale-pop on `target` itself.
  burst(target: Element): JSAnimation {
    const rect = target.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height / 2;
    const colors = ['#fbbf24', '#34d399', '#60a5fa', '#f472b6', '#a78bfa'];
    const particleCount = 14;

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('span');
      particle.style.position = 'fixed';
      particle.style.left = `${originX}px`;
      particle.style.top = `${originY}px`;
      particle.style.width = '6px';
      particle.style.height = '6px';
      particle.style.borderRadius = i % 3 === 0 ? '9999px' : '2px';
      particle.style.background = colors[i % colors.length];
      particle.style.zIndex = '9999';
      particle.style.pointerEvents = 'none';
      document.body.appendChild(particle);

      const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
      const distance = 40 + Math.random() * 40;

      animate(particle, {
        translateX: [0, Math.cos(angle) * distance],
        translateY: [0, Math.sin(angle) * distance],
        rotate: [0, Math.random() * 360],
        opacity: [1, 0],
        scale: [1, 0.3],
        duration: 700 + Math.random() * 300,
        ease: 'outQuad',
      }).then(() => particle.remove());
    }

    return this.pulse(target);
  }

  goldGlow(target: Element): JSAnimation {
    return animate(target as DOMTarget, {
      boxShadow: [
        '0 0 0 2px rgba(251, 191, 36, 0)',
        '0 0 10px 2px rgba(251, 191, 36, 0.95)',
        '0 0 0 2px rgba(251, 191, 36, 0)',
      ],
      duration: 1200,
      ease: 'outQuad',
    });
  }

  // Native WAAPI on `transform` runs on the compositor, so it keeps moving through the main-thread stalls of a loading screen (anime's waapi animates a CSS variable instead, which does not).
  // Loops forever, so the caller must cancel it on teardown. Percent translates are relative to the stripe's own width.
  shimmer(target: Element): Animation {
    return target.animate(
      [{ transform: 'translateX(-100%)' }, { transform: 'translateX(300%)' }],
      { duration: 1600, easing: 'ease-in-out', iterations: Infinity },
    );
  }

  // Holds fully opaque first so the bar can finish and the burst of first-render work behind the overlay lands unseen.
  dismissOverlay(target: Element): Animation {
    return target.animate([{ opacity: 1 }, { opacity: 0 }], {
      delay: 450,
      duration: 400,
      easing: 'ease-in-out',
      fill: 'both',
    });
  }

  // Opacity is zeroed up front so a delayed item doesn't sit visible until its turn.
  staggerIn(target: Element, index: number): JSAnimation {
    (target as HTMLElement).style.opacity = '0';
    return animate(target as DOMTarget, {
      opacity: [0, 1],
      translateY: [8, 0],
      duration: 220,
      delay: Math.min(index, 8) * 45,
      ease: 'outQuad',
    });
  }

  // Duration is capped at `lifetimeMs` since the playback service removes the element on its own timer.
  damageNumber(
    target: Element,
    options: {
      lifetimeMs: number;
      isHeal: boolean;
      variant?: DamageEventVariant;
      scale: number;
    },
  ): JSAnimation {
    const { lifetimeMs, isHeal, variant, scale } = options;
    const el = target as HTMLElement;
    el.style.opacity = '0';

    const profile =
      DAMAGE_NUMBER_PROFILES[variant ?? (isHeal ? 'heal' : 'normal')];
    const duration = lifetimeMs * (0.8 + Math.random() * 0.2);
    const holdMs = duration * profile.hold;
    const startY = (Math.random() - 0.5) * 12;
    const rise = profile.rise * (0.75 + Math.random() * 0.5);
    const tilt = (Math.random() - 0.5) * profile.tilt;

    return animate(el as DOMTarget, {
      opacity: [
        { from: 0, to: 1, duration: 80, ease: 'outQuad' },
        { to: 1, duration: holdMs },
        { to: 0, duration: duration - 80 - holdMs, ease: 'inQuad' },
      ],
      scale: this.damageNumberScaleKeyframes(scale, isHeal, variant),
      translateY: [
        { from: startY, to: startY - rise, duration, ease: 'outQuad' },
      ],
      translateX: this.damageNumberShiftKeyframes(duration, variant),
      rotate: [{ from: tilt, to: tilt * 0.3, duration, ease: 'outQuad' }],
      ...(variant === 'critical' && { color: this.critFlashKeyframes() }),
    });
  }

  private damageNumberScaleKeyframes(
    scale: number,
    isHeal: boolean,
    variant?: DamageEventVariant,
  ) {
    if (variant === 'critical') {
      return [
        { from: 0.3, to: scale * 1.7, duration: 110, ease: 'outQuad' },
        { to: scale * 1.3, duration: 140, ease: 'inOutQuad' },
      ];
    }

    if (variant === 'miss') {
      return [{ from: 0.6, to: 0.95, duration: 120, ease: 'outQuad' }];
    }

    if (variant === 'block') {
      return [
        { from: 0.5, to: 1.2, duration: 90, ease: 'outQuad' },
        { to: 1, duration: 120, ease: 'outBack' },
      ];
    }

    if (isHeal) {
      return [{ from: 0.8, to: scale, duration: 160, ease: 'outQuad' }];
    }

    return [
      { from: 0.4, to: scale * 1.25, duration: 110, ease: 'outQuad' },
      { to: scale, duration: 110, ease: 'inOutQuad' },
    ];
  }

  // Crits shake before drifting, and a miss slides sideways like the target stepped aside.
  private damageNumberShiftKeyframes(
    duration: number,
    variant?: DamageEventVariant,
  ) {
    const drift = (Math.random() - 0.5) * 20;

    if (variant === 'critical') {
      return [
        { from: 0, to: -4, duration: 40 },
        { to: 4, duration: 60 },
        { to: -3, duration: 60 },
        { to: 3, duration: 60 },
        { to: drift, duration: duration - 220, ease: 'inOutSine' },
      ];
    }

    if (variant === 'miss') {
      const direction = Math.random() < 0.5 ? -1 : 1;
      return [{ from: 0, to: direction * 22, duration, ease: 'outQuad' }];
    }

    return [{ from: 0, to: drift, duration, ease: 'inOutSine' }];
  }

  private critFlashKeyframes() {
    return [
      { from: '#fbbf24', to: '#ffffff', duration: 70 },
      { to: '#fbbf24', duration: 70 },
      { to: '#ffffff', duration: 70 },
      { to: '#fbbf24', duration: 70 },
      { to: '#ffffff', duration: 70 },
      { to: '#fbbf24', duration: 70 },
    ];
  }

  levelUp(target: Element): JSAnimation {
    this.burst(target);
    return this.goldGlow(target);
  }
}

// Snaps to `source()` on first read, tweens to it on every change after, and cancels
// an in-flight tween before starting the next so a rapid re-trigger can't race it.
// Must be called from an injection context (a field initializer or constructor).
export function injectTweenedNumber(
  source: () => number,
  enabled: () => boolean = () => true,
): Signal<number> {
  const anim = inject(AnimationService);
  const display = signal(0);
  let hasInitialized = false;
  let currentTween: JSAnimation | undefined;

  inject(DestroyRef).onDestroy(() => currentTween?.pause());

  effect(() => {
    const target = source();
    untracked(() => {
      if (!hasInitialized || !enabled()) {
        hasInitialized = true;
        currentTween?.pause();
        display.set(target);
        return;
      }
      currentTween?.pause();
      currentTween = anim.tweenNumber(display(), target, (v) => display.set(v));
    });
  });

  return display.asReadonly();
}
