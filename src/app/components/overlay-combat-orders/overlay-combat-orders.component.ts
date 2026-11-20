import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { IconComponent } from '@components/icon/icon.component';
import { PanelCombatSceneComponent } from '@components/panel-combat-scene/panel-combat-scene.component';
import { SFXDirective } from '@directives/sfx.directive';
import { combatLog } from '@helpers/combat/combat-log';
import { combatIsManual } from '@helpers/combat/combat-manual';
import {
  combatManualConfirm,
  combatManualFlee,
  combatManualOverlayOpen,
} from '@helpers/combat/combat-manual.ui';
import { gamepadBlockBehindOverlay } from '@helpers/engine/gamepad.ui';
import { hotkeysBlockOutside } from '@helpers/engine/hotkeys.ui';
import { isGameloopPaused } from '@helpers/gameloop';
import { worldCombatState } from '@helpers/state-game';
import { setOption } from '@helpers/state-options';
import type { CombatManualAction } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';
import { AnimationService } from '@services/animation.service';

// The world's Taskmaster fight: the combat scene full-screen, plus pausing, hotkeys and Flee.
@Component({
  selector: 'app-overlay-combat-orders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconComponent,
    PanelCombatSceneComponent,
    SFXDirective,
    SweetAlert2Module,
    TippyDirective,
  ],
  templateUrl: './overlay-combat-orders.component.html',
  host: { class: 'fixed inset-0 z-40 block' },
})
export class OverlayCombatOrdersComponent {
  private anim = inject(AnimationService);
  private scene = viewChild.required(PanelCombatSceneComponent);

  public liveCombat = computed(() =>
    combatIsManual() ? worldCombatState() : undefined,
  );
  public log = combatLog;
  public isPaused = isGameloopPaused;

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const fadeIn = this.anim.fadeIn(host, 300);
    // Registered ahead of the hotkey block, which stops every later keydown listener.
    const onEnter = (event: KeyboardEvent) => {
      if (event.key === 'Enter') this.scene().repeatLastOrder(event);
    };
    window.addEventListener('keydown', onEnter, { capture: true });
    const unblock = hotkeysBlockOutside(host);
    gamepadBlockBehindOverlay();
    combatManualOverlayOpen.set(true);
    inject(DestroyRef).onDestroy(() => {
      // A remount (e.g. after a story screen preempts the review) has no fight left to show, only the backdrop.
      combatManualOverlayOpen.set(false);
      unblock();
      window.removeEventListener('keydown', onEnter, { capture: true });
      fadeIn.pause();
    });
  }

  public confirm(action: CombatManualAction): void {
    combatManualConfirm(this.scene().combat(), action);
  }

  public flee(): void {
    const scene = this.scene();
    if (scene.isResolving()) return;
    scene.clearPreviousOrders();
    combatManualFlee(scene.combat());
  }

  public resume(): void {
    setOption('gameloopPaused', false);
  }

  public close(): void {
    combatManualOverlayOpen.set(false);
  }
}
