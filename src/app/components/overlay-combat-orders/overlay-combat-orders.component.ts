import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { AdventureLogMessageComponent } from '@components/adventure-log-message/adventure-log-message.component';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { CardStatusCombatantComponent } from '@components/card-status-combatant/card-status-combatant.component';
import { IconComponent } from '@components/icon/icon.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { StatusElementPoolComponent } from '@components/status-element-pool/status-element-pool.component';
import { TooltipSkillPreviewComponent } from '@components/tooltip-skill-preview/tooltip-skill-preview.component';
import { SFXDirective } from '@directives/sfx.directive';
import { combatLog } from '@helpers/combat/combat-log';
import { combatIsManual } from '@helpers/combat/combat-manual';
import {
  combatantIcon,
  combatManualFlee,
  combatManualOrder,
  combatManualRepeatOrder,
  combatManualTurnOrder,
  combatManualConfirm,
  combatManualHeroes,
  combatManualOverlayOpen,
  combatManualSkillOptions,
  combatManualStatusCard,
  combatManualTitle,
} from '@helpers/combat/combat-manual.ui';
import {
  COMBAT_MANUAL_REPEAT_DELAY_MS,
  COMBAT_MANUAL_ROUND_HOLD_MS,
} from '@helpers/config';
import { hotkeysBlockOutside } from '@helpers/engine/hotkeys.ui';
import { playGameSFX } from '@helpers/engine/sfx';
import { isGameloopPaused } from '@helpers/gameloop';
import { worldCombatState } from '@helpers/state-game';
import { setOption } from '@helpers/state-options';
import type {
  Combat,
  Combatant,
  CombatLog,
  CombatManualAction,
  CombatManualOrder,
  CombatManualSkillOption,
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
    SFXDirective,
    SlotIconBlankComponent,
    StatusElementPoolComponent,
    TippyDirective,
    TooltipSkillPreviewComponent,
    SweetAlert2Module,
  ],
  templateUrl: './overlay-combat-orders.component.html',
  host: { class: 'fixed inset-0 z-40 block' },
})
export class OverlayCombatOrdersComponent {
  private liveCombat = computed(() =>
    combatIsManual() ? worldCombatState() : undefined,
  );
  // Lags the live fight while a resolved round settles, so its damage numbers play before anything swaps.
  // Seeded with the live fight: effects read it before their first run would set it.
  private shownCombat = signal<Combat | undefined>(this.liveCombat());
  public isSettling = signal(false);
  // Once the fight ends the overlay keeps showing its last state for review.
  public isReview = computed(() => !this.liveCombat() && !this.isSettling());
  public combat = computed(() => this.shownCombat() as Combat);
  private seenCombatIds = signal<Set<string>>(new Set());

  public title = computed(() => combatManualTitle(this.combat()));
  public orders = signal<Partial<Record<string, CombatManualOrder>>>({});
  private chosenHeroId = signal<string | undefined>(undefined);
  public pendingSkillId = signal<string | undefined>(undefined);

  public isPaused = isGameloopPaused;
  public isResolving = computed(
    () => !!this.combat()?.manualActions || this.isSettling(),
  );
  public allies = computed(() => [
    ...this.combat().heroes,
    ...this.combat().helpers,
  ]);

  // Living heroes with at least one usable skill must have orders.
  public orderable = computed(() =>
    this.isReview()
      ? []
      : combatManualHeroes(this.combat()).filter(
          (hero) =>
            hero.hp > 0 &&
            combatManualSkillOptions(this.combat(), hero).some(
              (o) => !o.disabledReason,
            ),
        ),
  );

  public activeHero = computed(() => {
    const heroes = this.orderable();
    const chosen = heroes.find((h) => h.id === this.chosenHeroId());
    return chosen ?? heroes.find((h) => !this.orders()[h.id]);
  });

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

  public canConfirm = computed(() =>
    this.orderable().every((hero) => !!this.orders()[hero.id]),
  );

  // The latest round's lines, oldest first; spans fights so a chained fight still shows the last one's loot.
  public logEntries = computed(() => {
    const ids = this.seenCombatIds();
    const round: CombatLog[] = [];
    for (const entry of combatLog()) {
      if (!entry.combatId || !ids.has(entry.combatId)) continue;
      round.push(entry);
      if (entry.message.startsWith('_Combat round')) break;
    }
    return round.reverse();
  });

  public isEscaped = computed(() =>
    this.logEntries().some((e) => e.message === 'The party escaped!'),
  );

  // Last round's orders: pre-highlighted, and replayed when Enter is pressed.
  private previousOrders = signal<Record<string, CombatManualAction>>({});
  public previousSkillId = computed(() => {
    const hero = this.activeHero();
    return hero ? this.previousOrders()[hero.id]?.skillId : undefined;
  });

  public hoveredId = signal<string | undefined>(undefined);
  private lastEnterStepAt = 0;
  public turnOrder = computed(() =>
    combatManualTurnOrder(this.combat()).map((c) => ({
      id: c.id,
      name: c.name,
      isEnemy: c.isEnemy,
      icon: combatantIcon(c),
    })),
  );

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
    if (this.isResolving()) {
      return { tone: 'alert-info', text: 'Resolving...' };
    }
    if (option && hero) {
      return {
        tone: 'alert-info',
        text: `Pick a target for ${hero.name}'s ${option.skill.name}.`,
      };
    }
    if (hero) {
      return { tone: 'alert-info', text: `Choose a skill for ${hero.name}.` };
    }
    return {
      tone: 'alert-success',
      text: 'Every hero has orders!',
    };
  });

  public cardFor = combatManualStatusCard;

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const fadeIn = inject(AnimationService).fadeIn(host, 300);
    // Registered ahead of the hotkey block, which stops every later keydown listener.
    const onEnter = (event: KeyboardEvent) => {
      if (event.key === 'Enter') this.repeatLastRound(event);
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
      }, COMBAT_MANUAL_ROUND_HOLD_MS);
    };

    effect(() => {
      const live = this.liveCombat();
      untracked(() => {
        const shown = this.shownCombat();
        if (live && !this.seenCombatIds().has(live.id)) {
          this.seenCombatIds.update((ids) => new Set([...ids, live.id]));
        }
        if (!shown || (live && !this.isSettling() && live.id === shown.id)) {
          if (live && shown && live.rounds !== shown.rounds) hold(() => {});
          if (live) this.shownCombat.set(live);
          return;
        }
        // A new fight or the end of this one waits until the last round's numbers have played.
        if (live?.id !== shown.id)
          hold(() => this.shownCombat.set(live ?? shown));
        else this.shownCombat.set(live);
      });
    });

    let wasReview = false;
    effect(() => {
      const review = this.isReview();
      if (review && !wasReview) playGameSFX('item-get-major');
      wasReview = review;
    });

    // A new round, fight or resolved order set starts planning over.
    const roundKey = computed(() => {
      const c = this.combat();
      return c
        ? `${c.id}|${c.rounds}|${!!c.manualActions}|${!!c.ambushedBy}`
        : '';
    });
    effect(() => {
      roundKey();
      this.resetOrders();
    });
  }

  public pickSkill(option: CombatManualSkillOption): void {
    const hero = this.activeHero();
    if (!hero || option.disabledReason) return;
    if (option.targets.length === 0) {
      this.setOrder(hero, option);
      return;
    }
    this.pendingSkillId.set(option.skill.id);
  }

  public clickCombatant(c: Combatant): void {
    const hero = this.activeHero();
    const option = this.pendingOption();
    if (hero && option && this.targetableIds().has(c.id)) {
      this.setOrder(hero, option, c);
      return;
    }
    if (this.orderable().includes(c)) {
      this.chosenHeroId.set(c.id);
      this.pendingSkillId.set(undefined);
    }
  }

  private setOrder(
    hero: Combatant,
    option: CombatManualSkillOption,
    target?: Combatant,
  ): void {
    const order = combatManualOrder(option, target);
    this.orders.update((orders) => ({ ...orders, [hero.id]: order }));
    this.chosenHeroId.set(undefined);
    this.pendingSkillId.set(undefined);
  }

  public resetOrders(): void {
    this.orders.set({});
    this.chosenHeroId.set(undefined);
    this.pendingSkillId.set(undefined);
  }

  public confirm(): void {
    if (!this.canConfirm()) return;
    const actions: Record<string, CombatManualAction> = {};
    Object.entries(this.orders()).forEach(([id, order]) => {
      if (order) {
        actions[id] = { skillId: order.skillId, targetId: order.targetId };
      }
    });
    this.previousOrders.set(actions);
    combatManualConfirm(this.combat(), actions);
  }

  // Holding Enter keeps replaying last round's orders, filling in only heroes without one.
  // Each press (or held repeat) readies one hero from last round's orders; the press after the last one confirms.
  public repeatLastRound(event: KeyboardEvent): void {
    if (this.isReview() || this.isResolving() || this.isPaused()) return;
    if (document.querySelector('.swal2-container')) return;
    event.preventDefault();
    const sinceLastStep = Date.now() - this.lastEnterStepAt;
    if (event.repeat && sinceLastStep < COMBAT_MANUAL_REPEAT_DELAY_MS) return;
    this.lastEnterStepAt = Date.now();

    const hero = this.activeHero();
    if (!hero) {
      this.confirm();
      return;
    }
    const previous = this.previousOrders()[hero.id];
    const order = previous
      ? combatManualRepeatOrder(this.combat(), hero, previous)
      : undefined;
    if (!order) return;
    this.orders.update((orders) => ({ ...orders, [hero.id]: order }));
    this.chosenHeroId.set(undefined);
    this.pendingSkillId.set(undefined);
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
