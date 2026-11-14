import { DecimalPipe } from '@angular/common';
import type { AnimationCallbackEvent } from '@angular/core';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { AdventureLogMessageComponent } from '@components/adventure-log-message/adventure-log-message.component';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { CardStatusCombatantComponent } from '@components/card-status-combatant/card-status-combatant.component';
import { IconComponent } from '@components/icon/icon.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { StatusElementPoolComponent } from '@components/status-element-pool/status-element-pool.component';
import { TooltipSkillPreviewComponent } from '@components/tooltip-skill-preview/tooltip-skill-preview.component';
import { BackdropNodeComponent } from '@components/backdrop-node/backdrop-node.component';
import { ListReflowDirective } from '@directives/list-reflow.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { combatNodeBackground } from '@helpers/world-node/world-node-background.ui';
import { combatLog } from '@helpers/combat/combat-log';
import { combatIsManual } from '@helpers/combat/combat-manual';
import {
  combatManualAction,
  combatManualActiveHero,
  combatManualConfirm,
  combatManualElementVerdict,
  combatManualFlee,
  combatManualOverlayOpen,
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
import { hotkeysBlockOutside } from '@helpers/engine/hotkeys.ui';
import { isMotionReduced } from '@helpers/engine/motion';
import { playGameSFX } from '@helpers/engine/sfx';
import { isGameloopPaused } from '@helpers/gameloop';
import { worldCombatState } from '@helpers/state-game';
import { setOption } from '@helpers/state-options';
import type {
  Combat,
  Combatant,
  CombatLog,
  CombatManualAction,
  CombatManualSkillOption,
  ElementVerdict,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';
import { AnimationService } from '@services/animation.service';

@Component({
  selector: 'app-overlay-combat-orders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AdventureLogMessageComponent,
    AtlasImageComponent,
    CardStatusCombatantComponent,
    DecimalPipe,
    IconComponent,
    ListReflowDirective,
    BackdropNodeComponent,
    SFXDirective,
    SlotIconBlankComponent,
    StatusElementPoolComponent,
    TippyDirective,
    TooltipSkillPreviewComponent,
    SweetAlert2Module,
  ],
  templateUrl: './overlay-combat-orders.component.html',
  styleUrl: './overlay-combat-orders.component.scss',
  host: { class: 'fixed inset-0 z-40 block' },
})
export class OverlayCombatOrdersComponent {
  private anim = inject(AnimationService);
  private liveCombat = computed(() =>
    combatIsManual() ? worldCombatState() : undefined,
  );
  // Lags the live fight while a resolved turn settles, so its damage numbers play before anything swaps.
  // Seeded with the live fight: effects read it before their first run would set it.
  private shownCombat = signal<Combat | undefined>(this.liveCombat());
  public isSettling = signal(false);
  // Once the fight ends the overlay keeps showing its last state for review.
  public isReview = computed(() => !this.liveCombat() && !this.isSettling());
  public combat = computed(() => this.shownCombat() as Combat);
  private seenCombatIds = signal<Set<string>>(new Set());

  public title = computed(() => combatManualTitle(this.combat()));
  public backdrop = computed(() => {
    const combat = this.shownCombat();
    return combat ? combatNodeBackground(combat) : undefined;
  });
  public pendingSkillId = signal<string | undefined>(undefined);

  public isPaused = isGameloopPaused;
  public isMotionReduced = isMotionReduced;
  public allies = computed(() => [
    ...this.combat().heroes,
    ...this.combat().helpers,
  ]);

  public activeHero = computed(() =>
    this.isReview() ? undefined : combatManualActiveHero(this.combat()),
  );
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
    for (const entry of combatLog()) {
      if (!entry.combatId || !ids.has(entry.combatId)) continue;
      lines.push(entry);
      if (entry.message.startsWith('_Combat round')) rounds++;
      if (rounds === 2) break;
    }
    return lines.reverse();
  });

  private logBox = viewChild<ElementRef<HTMLElement>>('logBox');

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
    if (this.isPaused()) {
      return { tone: 'alert-warning', text: 'The game is paused.' };
    }
    if (this.isResolving() || !hero) {
      return { tone: 'alert-info', text: 'Resolving...' };
    }
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
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const fadeIn = this.anim.fadeIn(host, 300);
    // Registered ahead of the hotkey block, which stops every later keydown listener.
    const onEnter = (event: KeyboardEvent) => {
      if (event.key === 'Enter') this.repeatLastOrder(event);
    };
    window.addEventListener('keydown', onEnter, { capture: true });
    const unblock = hotkeysBlockOutside(host);
    combatManualOverlayOpen.set(true);
    inject(DestroyRef).onDestroy(() => {
      unblock();
      window.removeEventListener('keydown', onEnter, { capture: true });
      fadeIn.pause();
    });

    effect(() => {
      if (!this.isResolving() && !this.isReview()) {
        this.lastEnterStepAt = Date.now();
      }
    });

    let holdTimer: ReturnType<typeof setTimeout> | undefined;
    inject(DestroyRef).onDestroy(() => clearTimeout(holdTimer));
    const hold = (then: () => void) => {
      clearTimeout(holdTimer);
      this.isSettling.set(true);
      holdTimer = setTimeout(() => {
        then();
        this.isSettling.set(false);
      }, COMBAT_MANUAL_TURN_HOLD_MS);
    };

    effect(() => {
      const live = this.liveCombat();
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
            hold(() => {});
          }
          if (live) this.shownCombat.set(live);
          return;
        }
        // A new fight or the end of this one waits until the last turn's numbers have played.
        if (live?.id !== shown.id)
          hold(() => this.shownCombat.set(live ?? shown));
        else this.shownCombat.set(live);
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
      if (review && !wasReview) playGameSFX('item-get-major');
      wasReview = review;
    });

    // A new turn drops any half-picked skill.
    const turnKey = computed(() =>
      this.combat() ? combatManualTurnKey(this.combat()) : '',
    );
    effect(() => {
      turnKey();
      this.pendingSkillId.set(undefined);
    });
  }

  public pickSkill(option: CombatManualSkillOption): void {
    const hero = this.activeHero();
    if (!hero || option.disabledReason) return;
    if (option.targets.length === 0) {
      this.submit(hero, combatManualAction(option));
      return;
    }
    this.pendingSkillId.set(option.skill.id);
  }

  public clickCombatant(c: Combatant): void {
    const hero = this.activeHero();
    const option = this.pendingOption();
    if (hero && option && this.targetableIds().has(c.id)) {
      this.submit(hero, combatManualAction(option, c));
    }
  }

  private submit(hero: Combatant, action: CombatManualAction): void {
    if (this.isResolving()) return;
    this.pendingSkillId.set(undefined);
    this.previousOrders.update((orders) => ({ ...orders, [hero.id]: action }));
    combatManualConfirm(this.combat(), action);
  }

  public repeatLastOrder(event: KeyboardEvent): void {
    if (this.isReview() || this.isResolving() || this.isPaused()) return;
    if (document.querySelector('.swal2-container')) return;
    event.preventDefault();
    const sinceLastStep = Date.now() - this.lastEnterStepAt;
    if (event.repeat && sinceLastStep < COMBAT_MANUAL_REPEAT_DELAY_MS) return;
    this.lastEnterStepAt = Date.now();

    const hero = this.activeHero();
    const previous = hero ? this.previousOrders()[hero.id] : undefined;
    const action =
      hero && previous
        ? combatManualRepeatAction(this.combat(), hero, previous)
        : undefined;
    if (hero && action) this.submit(hero, action);
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

  public flee(): void {
    if (this.isResolving()) return;
    this.previousOrders.set({});
    combatManualFlee(this.combat());
  }

  public resume(): void {
    setOption('gameloopPaused', false);
  }

  public close(): void {
    combatManualOverlayOpen.set(false);
  }
}
