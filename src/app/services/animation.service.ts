import { formatNumber } from '@angular/common';
import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  LOCALE_ID,
  signal,
  untracked,
  type Signal,
} from '@angular/core';
import { isMotionReduced } from '@helpers/engine/motion';
import type { DamageEventVariant } from '@interfaces';
import { sumBy } from 'es-toolkit/compat';
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
  shield: { hold: 0.4, rise: 16, tilt: 0 },
};

const SHATTER_COLUMNS = 7;
const SHATTER_ROWS = 4;
// Outer vertices are pushed out this far so each shard keeps its slice of a shadow-xl.
const SHATTER_EDGE_BLEED_PX = 48;
const SHATTER_SHARD_MS = 650;
const SHATTER_SMOKE_MS = 750;

// CSS equivalents of anime's outBack/inQuad/inOutSine, for native WAAPI.
const EASE_OUT_BACK = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
const EASE_IN_QUAD = 'cubic-bezier(0.11, 0, 0.5, 0)';
const EASE_IN_OUT_SINE = 'cubic-bezier(0.37, 0, 0.63, 1)';

function gridDistance(
  index: number,
  cols: number,
  from: { x: number; y: number },
): number {
  return Math.hypot((index % cols) - from.x, Math.floor(index / cols) - from.y);
}

@Injectable({
  providedIn: 'root',
})
export class AnimationService {
  private locale = inject(LOCALE_ID);
  // Angular can fire a leave handler twice for one element; a second shatter would clone the shards too.
  private shattering = new WeakMap<Element, Promise<unknown>>();

  popIn(target: Element): JSAnimation {
    return animate(target as DOMTarget, {
      opacity: [0, 0.85],
      ...this.motion({ scale: [0.8, 1] }),
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
      ...this.motion({ translateX: [20, 0] }),
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
      ...this.motion({
        translateX: [0, 24],
        height: { from: height, to: 0, delay: 120, duration: 180 },
        marginBottom: { from: 0, to: -gap, delay: 120, duration: 180 },
      }),
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
      ...this.motion({ translateY: [-8, 0] }),
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
      ...this.motion({ translateY: [0, -16] }),
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
    if (isMotionReduced()) return this[arrival](target);

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
    if (isMotionReduced()) return this.goldGlow(target);

    return animate(target as DOMTarget, {
      scale: [
        { to: 0.95, duration: 200, ease: 'outQuad' },
        { to: 1, duration: 250, ease: 'outBack' },
      ],
    });
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

  // Plays an element from its old layout position (dx, dy away) to where it now sits, on the compositor.
  reflow(target: Element, dx: number, dy: number): Animation {
    return target.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
      { duration: 260, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    );
  }

  // A lone `from` keyframe fades up to the element's own resting opacity, so dimmed rows don't flash to full and snap back.
  reflowEnter(target: Element): Animation {
    return target.animate([{ opacity: 0, offset: 0 }], {
      duration: 200,
      easing: 'ease-out',
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

  dismissOverlay(target: Element): Animation {
    return target.animate([{ opacity: 1 }, { opacity: 0 }], {
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
      ...this.motion({ translateY: [8, 0] }),
      duration: 220,
      delay: Math.min(index, 8) * 45,
      ease: 'outQuad',
    });
  }

  // The loading-screen animations below are native WAAPI on transform/opacity/filter so they run on the compositor through its main-thread stalls.
  // Backwards fill holds each cell hidden until its stagger delay passes.
  gridReveal(
    targets: HTMLElement[],
    cols: number,
    rows: number,
  ): Promise<unknown> {
    const center = { x: (cols - 1) / 2, y: (rows - 1) / 2 };
    return Promise.all(
      targets.map(
        (el, i) =>
          el.animate(
            [
              { opacity: 0, transform: 'scale(0.4)' },
              { opacity: 1, transform: 'scale(1)' },
            ],
            {
              duration: 700,
              delay: gridDistance(i, cols, center) * 25,
              easing: EASE_OUT_BACK,
              fill: 'backwards',
            },
          ).finished,
      ),
    );
  }

  // A lone midpoint keyframe glows the sprite up from, and back down to, its own resting (or hovered) style.
  gridRipple(targets: HTMLElement[], cols: number, fromIndex: number): void {
    const origin = { x: fromIndex % cols, y: Math.floor(fromIndex / cols) };
    targets.forEach((el, i) => {
      const timing = {
        duration: 900,
        delay: gridDistance(i, cols, origin) * 35,
        easing: EASE_IN_OUT_SINE,
      };
      el.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(1.3)' },
          { transform: 'scale(1)' },
        ],
        timing,
      );
      el.firstElementChild?.animate(
        [{ offset: 0.5, opacity: 0.82, filter: 'grayscale(0) sepia(0.2)' }],
        timing,
      );
    });
  }

  // Forwards fill keeps the icon hidden until the caller removes or refills it.
  iconSwapOut(target: Element): Animation {
    return target.animate(
      [
        { opacity: 1, transform: 'scale(1) rotate(0deg)' },
        { opacity: 0, transform: 'scale(0.5) rotate(-20deg)' },
      ],
      { duration: 500, easing: EASE_IN_QUAD, fill: 'forwards' },
    );
  }

  iconSwapIn(target: Element): Animation {
    return target.animate(
      [
        { opacity: 0, transform: 'scale(0.5) rotate(20deg)' },
        { opacity: 1, transform: 'scale(1) rotate(0deg)' },
      ],
      { duration: 800, easing: EASE_OUT_BACK },
    );
  }

  // Loops forever, so the caller must cancel it on teardown.
  bob(target: Element): Animation {
    return target.animate(
      [{ transform: 'translateY(0)' }, { transform: 'translateY(-6px)' }],
      {
        duration: 900,
        easing: EASE_IN_OUT_SINE,
        iterations: Infinity,
        direction: 'alternate',
      },
    );
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
      ...this.motion({
        scale: this.damageNumberScaleKeyframes(scale, isHeal, variant),
        translateY: [
          { from: startY, to: startY - rise, duration, ease: 'outQuad' },
        ],
        translateX: this.damageNumberShiftKeyframes(duration, variant),
        rotate: [{ from: tilt, to: tilt * 0.3, duration, ease: 'outQuad' }],
        ...(variant === 'critical' ? { color: this.critFlashKeyframes() } : {}),
      }),
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
    if (isMotionReduced()) return this.goldGlow(target);

    this.pulse(target);
    return this.goldGlow(target);
  }

  // Hides `target` and scatters clipped clones of it as shards that dissolve into smoke; meant for a leave handler,
  // since the shards live inside `target` and go away with it.
  shatterIntoSmoke(target: Element): Promise<unknown> {
    if (isMotionReduced()) return this.fadeOut(target).then(() => undefined);

    const running = this.shattering.get(target);
    if (running) return running;

    const el = target as HTMLElement;
    // A CSS animation ending mid-shatter would make Angular treat the leave as finished.
    el.style.animation = 'none';
    const source = el.cloneNode(true) as HTMLElement;
    const points = this.shatterGrid(el.offsetWidth, el.offsetHeight);
    el.style.visibility = 'hidden';

    const animations = points.slice(1).flatMap((row, r) =>
      row.slice(1).flatMap((_, c) => {
        const polygon = [
          points[r][c],
          points[r][c + 1],
          points[r + 1][c + 1],
          points[r + 1][c],
        ];
        const delay = Math.random() * 150;
        return [
          this.shatterShard(el, source, polygon, delay),
          this.smokePuff(el, polygon, delay),
        ];
      }),
    );
    const done = Promise.all(animations);
    this.shattering.set(target, done);
    return done;
  }

  // Jittered interior vertices make irregular shards that still tile the box with no gaps.
  private shatterGrid(width: number, height: number): [number, number][][] {
    const cellWidth = width / SHATTER_COLUMNS;
    const cellHeight = height / SHATTER_ROWS;
    const place = (index: number, count: number, cell: number) => {
      if (index === 0) return -SHATTER_EDGE_BLEED_PX;
      if (index === count) return count * cell + SHATTER_EDGE_BLEED_PX;
      return (index + (Math.random() - 0.5) * 0.6) * cell;
    };

    return Array.from({ length: SHATTER_ROWS + 1 }, (_, r) =>
      Array.from({ length: SHATTER_COLUMNS + 1 }, (_, c) => [
        place(c, SHATTER_COLUMNS, cellWidth),
        place(r, SHATTER_ROWS, cellHeight),
      ]),
    );
  }

  private polygonCenter(polygon: [number, number][]): [number, number] {
    return [
      sumBy(polygon, ([x]) => x) / polygon.length,
      sumBy(polygon, ([, y]) => y) / polygon.length,
    ];
  }

  private shatterShard(
    host: HTMLElement,
    source: HTMLElement,
    polygon: [number, number][],
    delay: number,
  ): JSAnimation {
    const [cx, cy] = this.polygonCenter(polygon);
    const shard = source.cloneNode(true) as HTMLElement;
    Object.assign(shard.style, {
      position: 'absolute',
      inset: '0',
      margin: '0',
      visibility: 'visible',
      animation: 'none',
      transition: 'none',
      transformOrigin: `${cx}px ${cy}px`,
      clipPath: `polygon(${polygon.map(([x, y]) => `${x}px ${y}px`).join(',')})`,
    });
    host.appendChild(shard);

    const dx = cx - host.offsetWidth / 2;
    const dy = cy - host.offsetHeight / 2;
    return animate(shard, {
      translateX: dx * 0.4 + (Math.random() - 0.5) * 40,
      translateY: dy * 0.4 - 10 - Math.random() * 30,
      rotate: (Math.random() - 0.5) * 50,
      scale: 0.6,
      opacity: { to: 0, ease: 'inQuad' },
      duration: SHATTER_SHARD_MS,
      delay,
      ease: 'outCubic',
    });
  }

  private smokePuff(
    host: HTMLElement,
    polygon: [number, number][],
    delay: number,
  ): JSAnimation {
    const [cx, cy] = this.polygonCenter(polygon);
    const size = (host.offsetWidth / SHATTER_COLUMNS) * 1.6;
    const puff = document.createElement('div');
    Object.assign(puff.style, {
      position: 'absolute',
      left: `${cx - size / 2}px`,
      top: `${cy - size / 2}px`,
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '9999px',
      visibility: 'visible',
      opacity: '0',
      background:
        'radial-gradient(circle, color-mix(in oklab, var(--color-base-content) 40%, transparent) 0%, transparent 70%)',
    });
    host.appendChild(puff);

    return animate(puff, {
      translateX: (Math.random() - 0.5) * 50,
      translateY: -20 - Math.random() * 40,
      scale: [0.3, 1.8],
      opacity: [
        { to: 1, duration: SHATTER_SMOKE_MS * 0.25, ease: 'outQuad' },
        { to: 0, duration: SHATTER_SMOKE_MS * 0.75, ease: 'inQuad' },
      ],
      delay: delay + 60,
      ease: 'outQuad',
    });
  }

  // Movement is dropped under reduced motion; fades and glows still play.
  private motion<T extends object>(props: T): T | Record<string, never> {
    return isMotionReduced() ? {} : props;
  }
}

// Shows `source()` from the first render (never a 0 that then fills in), tweens to it on every change after, and
// cancels an in-flight tween before starting the next so a rapid re-trigger can't race it.
// Must be called from an injection context (a field initializer or constructor).
export function injectTweenedNumber(
  source: () => number,
  enabled: () => boolean = () => true,
): Signal<number> {
  const anim = inject(AnimationService);
  const display = signal(0);
  const isReady = signal(false);
  let currentTween: JSAnimation | undefined;

  inject(DestroyRef).onDestroy(() => currentTween?.pause());

  effect(() => {
    const target = source();
    untracked(() => {
      if (!isReady() || !enabled()) {
        currentTween?.pause();
        display.set(target);
        isReady.set(true);
        return;
      }
      currentTween?.pause();
      currentTween = anim.tweenNumber(display(), target, (v) => display.set(v));
    });
  });

  return computed(() => (isReady() ? display() : source()));
}
