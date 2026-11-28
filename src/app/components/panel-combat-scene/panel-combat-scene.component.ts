import { TPipe } from '@pipes/t.pipe';
import { ContentNamePipe } from '@pipes/content-name.pipe';
import { FFFocusMemoryDirective } from '@ff/focus/ff-focus-memory.directive';
import { combatantIsDead } from '@helpers/combat/combat-combatant-hp';
import { FFFocusService } from '@ff/focus/ff-focus.service';
import { ffGamepadOn } from '@ff/input/ff-gamepad-on';
import {
  GAMEPAD_PRIORITY,
  gamepadBindInspectTips,
} from '@helpers/engine/gamepad.ui';
import { DecimalPipe } from '@angular/common';
import type { AnimationCallbackEvent } from '@angular/core';
import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { AdventureLogMessageComponent } from '@components/adventure-log-message/adventure-log-message.component';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { BackdropNodeComponent } from '@components/backdrop-node/backdrop-node.component';
import { CardStatusCombatantComponent } from '@components/card-status-combatant/card-status-combatant.component';
import { IconComponent } from '@components/icon/icon.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { StatusElementPoolComponent } from '@components/status-element-pool/status-element-pool.component';
import { TooltipSkillPreviewComponent } from '@components/tooltip-skill-preview/tooltip-skill-preview.component';
import { ListReflowDirective } from '@directives/list-reflow.directive';
import { SFXDirective } from '@directives/sfx.directive';
import {
  combatManualAction,
  combatManualActiveHero,
  combatManualElementVerdict,
  combatManualRepeatAction,
  combatManualSkillOptions,
  combatManualStatusCard,
  combatManualTitle,
  combatManualTurnKey,
  combatManualTurnOrder,
} from '@helpers/combat/combat-manual.ui';
import {
  COMBAT_MANUAL_REPEAT_DELAY_MS,
  COMBAT_MANUAL_TURN_HOLD_MS,
} from '@helpers/config';
import { isMotionReduced } from '@helpers/engine/motion';
import { modalHasAnyOpen } from '@helpers/engine/modal-stack';
import { playGameSFX, playSFX } from '@helpers/engine/sfx';
import { combatNodeBackground } from '@helpers/world-node/world-node-background.ui';
import type {
  Combat,
  Combatant,
  CombatLog,
  CombatManualAction,
  CombatManualSkillOption,
  ElementVerdict,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import { AnimationService } from '@services/animation.service';

// The battle view of a manual fight: shows `liveCombat`, holds each resolved turn on screen, and emits the player's picks.
@Component({
  selector: 'app-panel-combat-scene',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TPipe,
    ContentNamePipe,
    AdventureLogMessageComponent,
    AtlasImageComponent,
    BackdropNodeComponent,
    CardStatusCombatantComponent,
    DecimalPipe,
    IconComponent,
    ListReflowDirective,
    SFXDirective,
    SlotIconBlankComponent,
    StatusElementPoolComponent,
    TippyDirective,
    TooltipSkillPreviewComponent,
  ],
  templateUrl: './panel-combat-scene.component.html',
  styleUrl: './panel-combat-scene.component.scss',
  // Focus lost mid-turn (a skill list emptying, a target dying) lands back inside the scene, not on the page's rail.
  hostDirectives: [FFFocusMemoryDirective],
  host: {
    class: 'card relative bg-base-100 shadow-xl',
    '[class.hidden]': '!shownCombat()',
  },
})
export class PanelCombatSceneComponent {
  private anim = inject(AnimationService);

  // Undefined once the fight is over, which turns the scene into its review.
  public liveCombat = input<Combat>();
  public log = input.required<CombatLog[]>();
  public paused = input(false);
  public eventKeyPrefix = input('');
  public confirmed = output<CombatManualAction>();

  // Lags the live fight while a resolved turn settles, so its damage numbers play before anything swaps.
  public shownCombat = signal<Combat | undefined>(undefined);
  public isSettling = signal(false);
  // Once the fight ends the scene keeps showing its last state for review.
  public isReview = computed(() => !this.liveCombat() && !this.isSettling());
  public combat = computed(() => this.shownCombat() as Combat);
  private seenCombatIds = signal<Set<string>>(new Set());
  // A run can start its next fight and end inside one hold; the review should land on that last fight.
  private latestLive: Combat | undefined;

  public title = computed(() => combatManualTitle(this.combat()));
  public backdrop = computed(() => {
    const combat = this.shownCombat();
    return combat ? combatNodeBackground(combat) : undefined;
  });
  public pendingSkillId = signal<string | undefined>(undefined);

  public isMotionReduced = isMotionReduced;
  public allies = computed(() => [
    ...this.combat().heroes,
    ...this.combat().helpers,
  ]);

  // Effects can read this before the first fight is shown.
  public activeHero = computed(() => {
    const combat = this.shownCombat();
    return combat && !this.isReview()
      ? combatManualActiveHero(combat)
      : undefined;
  });
  public isResolving = computed(() => !this.activeHero() || this.isSettling());

  public skillOptions = computed(() => {
    const hero = this.activeHero();
    return hero ? combatManualSkillOptions(this.combat(), hero) : [];
  });

  public pendingOption = computed(() =>
    this.skillOptions().find((o) => o.skill.id === this.pendingSkillId()),
  );

  public targetableIds = computed(
    () => new Set((this.pendingOption()?.targets ?? []).map((c) => c.id)),
  );

  // This round's and the last round's lines, oldest first; spans fights so a chained fight still shows the last one's loot.
  public logEntries = computed(() => {
    const ids = this.seenCombatIds();
    const lines: CombatLog[] = [];
    let rounds = 0;
    for (const entry of this.log()) {
      if (!entry.combatId || !ids.has(entry.combatId)) continue;
      lines.push(entry);
      // Entries logged before roundStart existed are English.
      if (entry.roundStart || entry.message.startsWith('_Combat round')) {
        rounds++;
      }
      if (rounds === 2) break;
    }
    return lines.reverse();
  });

  private logBox = viewChild<ElementRef<HTMLElement>>('logBox');
  private skillGrid = viewChild<ElementRef<HTMLElement>>('skillGrid');
  private readonly host =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly focus = inject(FFFocusService);

  public isEscaped = computed(() =>
    this.logEntries().some((e) => e.message === 'The party escaped!'),
  );

  // Each hero's last order: pre-highlighted, and replayed when Enter is pressed.
  private previousOrders = signal<Record<string, CombatManualAction>>({});
  public previousSkillId = computed(() => {
    const hero = this.activeHero();
    return hero ? this.previousOrders()[hero.id]?.skillId : undefined;
  });

  public hoveredId = signal<string | undefined>(undefined);
  public hoveredSkillId = signal<string | undefined>(undefined);

  // A picked skill wins over a hovered one, so tags stay put while choosing a target.
  private taggedSkill = computed(
    () =>
      this.pendingOption()?.skill ??
      this.skillOptions().find((o) => o.skill.id === this.hoveredSkillId())
        ?.skill,
  );

  public enemyElementTags = computed(() => {
    const hero = this.activeHero();
    const skill = this.taggedSkill();
    const tags = new Map<string, ElementVerdict | undefined>();
    if (!hero || !skill) return tags;
    this.combat()
      .guardians.filter((enemy) => enemy.hp > 0)
      .forEach((enemy) =>
        tags.set(enemy.id, combatManualElementVerdict(hero, enemy, skill)),
      );
    return tags;
  });

  public skillElementHints = computed(() => {
    const hero = this.activeHero();
    const enemy = this.combat().guardians.find(
      (c) => c.id === this.hoveredId(),
    );
    const hints = new Map<string, ElementVerdict | undefined>();
    if (!hero || !enemy) return hints;
    this.skillOptions().forEach(({ skill }) =>
      hints.set(skill.id, combatManualElementVerdict(hero, enemy, skill)),
    );
    return hints;
  });
  private lastEnterStepAt = 0;
  public turnOrder = computed(() => combatManualTurnOrder(this.combat()));

  public isVictory = computed(() =>
    this.logEntries().some((e) => e.message === 'Heroes have won the combat!'),
  );

  public status = computed(() => {
    const option = this.pendingOption();
    const hero = this.activeHero();
    if (this.isReview() && this.isEscaped()) {
      return { tone: 'alert-info', text: 'The party escaped.' };
    }
    if (this.isReview()) {
      return this.isVictory()
        ? {
            tone: 'alert-success',
            text: 'Victory!',
          }
        : { tone: 'alert-error', text: 'You lost the fight.' };
    }
    if (this.paused()) {
      return { tone: 'alert-warning', text: 'The game is paused.' };
    }
    if (this.isResolving() || !hero) return undefined;
    if (option) {
      return {
        tone: 'alert-info',
        text: `Pick a target for ${hero.name}'s ${option.skill.name}.`,
      };
    }
    return { tone: 'alert-info', text: `Choose a skill for ${hero.name}.` };
  });

  public cardFor = combatManualStatusCard;

  constructor() {
    effect(() => {
      if (!this.isResolving() && !this.isReview()) {
        this.lastEnterStepAt = Date.now();
      }
    });

    let holdTimer: ReturnType<typeof setTimeout> | undefined;
    inject(DestroyRef).onDestroy(() => clearTimeout(holdTimer));
    // Lands on the latest state, so ticks arriving mid-hold neither restart it nor get skipped past.
    const hold = () => {
      clearTimeout(holdTimer);
      this.isSettling.set(true);
      holdTimer = setTimeout(() => {
        this.shownCombat.set(this.latestLive);
        this.isSettling.set(false);
      }, COMBAT_MANUAL_TURN_HOLD_MS);
    };

    effect(() => {
      const live = this.liveCombat();
      if (live) this.latestLive = live;
      untracked(() => {
        const shown = this.shownCombat();
        if (live && !this.seenCombatIds().has(live.id)) {
          this.seenCombatIds.update((ids) => new Set([...ids, live.id]));
        }
        if (!shown || (live && !this.isSettling() && live.id === shown.id)) {
          if (
            live &&
            shown &&
            combatManualTurnKey(live) !== combatManualTurnKey(shown)
          ) {
            hold();
          }
          if (live) this.shownCombat.set(live);
          return;
        }
        // A new fight or the end of this one waits until the last turn's numbers have played.
        if (live?.id !== shown.id) {
          if (!this.isSettling()) hold();
        } else this.shownCombat.set(live);
      });
    });

    afterRenderEffect({
      write: () => {
        this.logEntries();
        const box = this.logBox()?.nativeElement;
        box?.scrollTo({ top: box.scrollHeight });
      },
    });

    let wasReview = false;
    effect(() => {
      const review = this.isReview();
      if (review && !wasReview && this.shownCombat()) {
        playGameSFX('item-get-major');
      }
      wasReview = review;
    });

    // A new turn drops any half-picked skill.
    const turnKey = computed(() =>
      this.shownCombat() ? combatManualTurnKey(this.combat()) : '',
    );
    effect(() => {
      turnKey();
      this.pendingSkillId.set(undefined);
    });

    // Each hero turn starts in the skill list, on the skill used last if any.
    const turnReady = computed(() => (this.isResolving() ? '' : turnKey()));
    const injector = inject(Injector);
    effect(() => {
      if (!turnReady()) return;
      // After render, since the skill list only exists once the turn is shown.
      afterNextRender(
        () => {
          const landing = this.skillLanding();
          if (landing) this.focus.focusElement(landing);
        },
        { injector },
      );
    });
    ffGamepadOn('back', () => this.cancelPick(), {
      priority: GAMEPAD_PRIORITY.popover,
      enabled: () => !!this.pendingSkillId(),
      label: 'Cancel',
    });
    // After Cancel, so B closes an open inspect before it drops the picked skill.
    gamepadBindInspectTips('.scene-combatant', () => !this.isResolving());
  }

  private skillLanding(): HTMLElement | undefined {
    const grid = this.skillGrid()?.nativeElement;
    return (
      grid?.querySelector<HTMLElement>('[aria-current="true"]') ??
      grid?.querySelector<HTMLElement>('button') ??
      undefined
    );
  }

  private idleFocus(): HTMLElement | undefined {
    return (
      this.host.querySelector<HTMLElement>(
        '.scene-combatant:not(.ff-focus-skip):not([disabled])',
      ) ?? undefined
    );
  }

  private cancelPick(): void {
    const picked = this.skillGrid()?.nativeElement.querySelector<HTMLElement>(
      '[aria-pressed="true"]',
    );
    this.pendingSkillId.set(undefined);
    this.focus.focusNextFrame(() => picked ?? this.skillLanding());
  }

  public pickSkill(option: CombatManualSkillOption): void {
    const hero = this.activeHero();
    if (!hero || option.disabledReason) return;
    if (option.targets.length === 0) {
      this.submit(hero, combatManualAction(option));
      return;
    }
    this.pendingSkillId.set(option.skill.id);
    this.focus.focusNextFrame(
      () => this.host.querySelector<HTMLElement>('.target-ring') ?? undefined,
    );
  }

  // The fallen have nothing left to inspect, so they don't take focus or preview.
  public isDead = combatantIsDead;

  public hover(c: Combatant): void {
    if (!combatantIsDead(c)) this.hoveredId.set(c.id);
  }

  public clickCombatant(c: Combatant): void {
    const hero = this.activeHero();
    const option = this.pendingOption();
    if (hero && option && this.targetableIds().has(c.id)) {
      this.submit(hero, combatManualAction(option, c));
    }
  }

  private submit(hero: Combatant, action: CombatManualAction): boolean {
    if (this.isResolving()) return false;
    this.pendingSkillId.set(undefined);
    this.previousOrders.update((orders) => ({ ...orders, [hero.id]: action }));
    this.confirmed.emit(action);
    // The skill list empties while the turn resolves; parked on an enemy, a stray A does nothing instead of hitting the side rail.
    this.focus.focusNextFrame(() => this.idleFocus());
    return true;
  }

  public repeatLastOrder(event: KeyboardEvent): void {
    if (this.isReview() || modalHasAnyOpen()) return;
    if (document.querySelector('.swal2-container')) return;
    // Swallowed even when idle, or it would click whichever button has focus.
    event.preventDefault();
    if (this.isResolving() || this.paused()) return;
    const sinceLastStep = Date.now() - this.lastEnterStepAt;
    if (event.repeat && sinceLastStep < COMBAT_MANUAL_REPEAT_DELAY_MS) return;
    this.lastEnterStepAt = Date.now();

    const hero = this.activeHero();
    const previous = hero ? this.previousOrders()[hero.id] : undefined;
    const action =
      hero && previous
        ? combatManualRepeatAction(this.combat(), hero, previous)
        : undefined;
    if (hero && action && this.submit(hero, action)) playSFX('ui-click', 1);
  }

  public clearPreviousOrders(): void {
    this.previousOrders.set({});
  }

  public onTagEnter(event: AnimationCallbackEvent): void {
    this.anim.fadeIn(event.target, 150);
  }

  public onTurnSlotLeave(event: AnimationCallbackEvent): void {
    if (isMotionReduced()) {
      event.animationComplete();
      return;
    }
    this.anim
      .fadeOutCollapseWidth(event.target)
      .then(() => event.animationComplete())
      .catch(() => event.animationComplete());
  }

  public onSlotLeave(event: AnimationCallbackEvent): void {
    this.anim
      .fadeOut(event.target)
      .then(() => event.animationComplete())
      .catch(() => event.animationComplete());
  }
}
