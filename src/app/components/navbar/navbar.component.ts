import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { isDemoBuild } from '@helpers/demo/demo';
import { ButtonGlowDirective } from '@directives/button-glow.directive';
import { ButtonQuitComponent } from '@components/button-quit/button-quit.component';
import { ButtonRunEndComponent } from '@components/button-run-end/button-run-end.component';
import { ButtonAchievementsComponent } from '@components/button-achievements/button-achievements.component';
import { ButtonSettingsComponent } from '@components/button-settings/button-settings.component';
import { ButtonUpdateComponent } from '@components/button-update/button-update.component';
import { IconComponent } from '@components/icon/icon.component';
import { ModalCaravanTradeComponent } from '@components/modal-caravan-trade/modal-caravan-trade.component';
import { ModalExchangeNodeComponent } from '@components/modal-exchange-node/modal-exchange-node.component';
import { ModalOutpostTeleportComponent } from '@components/modal-outpost-teleport/modal-outpost-teleport.component';
import { ModalTasksComponent } from '@components/modal-tasks/modal-tasks.component';
import { ModalTownMaterialSaleComponent } from '@components/modal-town-material-sale/modal-town-material-sale.component';
import { ModalTrainerVisitComponent } from '@components/modal-trainer-visit/modal-trainer-visit.component';
import { ModalComponent } from '@components/modal/modal.component';
import { HideUntilLevelDirective } from '@directives/hide-until-level.directive';
import { RequireNotSetupDirective } from '@directives/no-setup.directive';
import { RequireSetupDirective } from '@directives/require-setup.directive';
import { FFButtonComponent } from '@ff/components/button/button.component';
import { FFInputPromptComponent } from '@ff/components/input-prompt/input-prompt.component';
import { TutorialTargetDirective } from '@directives/tutorial-target.directive';
import { ffGamepadOn } from '@ff/input/ff-gamepad-on';
import { FFInputService } from '@ff/input/ff-input.service';
import { DECREE_REVEAL_LEVEL } from '@helpers/config';
import { isRevealedAtLevel } from '@helpers/engine/feature-reveal';
import { GAMEPAD_PRIORITY } from '@helpers/engine/gamepad.ui';
import {
  gamePlayViewsCyclable,
  gamePlayViewStep,
} from '@helpers/engine/gameplay-view-cycle.ui';
import {
  modalClose,
  modalCloseTop,
  modalHasAnyOpen,
  modalIsOpen,
  modalIsTopmost,
  modalOpen,
} from '@helpers/engine/modal-stack';
import {
  caravanTradeOpen,
  closeAllMenus,
  gamePlayView,
  heroesSubviewClear,
  isWorldCameraPanned,
  kingdomSubview,
  kingdomSubviewClear,
  navigationGuarded,
  setGamePlayView,
  townOpen,
  trainerVisitOpen,
  worldCameraRecenter,
} from '@helpers/engine/ui';
import { isFelDefeated } from '@helpers/lore/outro';
import { isSetup } from '@helpers/setup';
import { saveGameState } from '@helpers/state-game';
import { getOption, setOption } from '@helpers/state-options';
import { worldNodeAtCurrentLocation } from '@helpers/world';
import { worldNodeCaravanIsAvailable } from '@helpers/world-node/world-node-caravan.ui';
import {
  worldNodeCaravan,
  worldNodeTown,
  worldNodeTrainer,
} from '@helpers/world-node/world-nodes';
import type { GamePlayView, Icon } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import { MetaService } from '@services/meta.service';
import type { SwalComponent } from '@sweetalert2/ngx-sweetalert2';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';

import { BarResourceComponent } from '@components/bar-resource/bar-resource.component';
import { PanelDebugButtonsComponent } from '@components/panel-debug-buttons/panel-debug-buttons.component';
import {
  autoModeIsEnabled,
  autoModeToggle,
  decreeActiveClauseId,
  decreeClauses,
  decreeClauseSummary,
} from '@helpers/decree';

@Component({
  selector: 'app-navbar',
  imports: [
    TippyDirective,
    RequireSetupDirective,
    IconComponent,
    SweetAlert2Module,
    FFButtonComponent,
    FFInputPromptComponent,
    ButtonUpdateComponent,
    RequireNotSetupDirective,
    ModalComponent,
    ButtonQuitComponent,
    ButtonRunEndComponent,
    ButtonAchievementsComponent,
    ButtonSettingsComponent,
    ButtonGlowDirective,
    BarResourceComponent,
    ModalCaravanTradeComponent,
    ModalTasksComponent,
    ModalOutpostTeleportComponent,
    ModalTrainerVisitComponent,
    ModalExchangeNodeComponent,
    ModalTownMaterialSaleComponent,
    PanelDebugButtonsComponent,
    HideUntilLevelDirective,
    TutorialTargetDirective,
  ],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent {
  public meta = inject(MetaService);
  private ffInput = inject(FFInputService);
  public readonly isDemo = isDemoBuild();
  public router = inject(Router);

  public showPauseMenu = computed(() => modalIsOpen('pause-menu'));
  private wasPausedBeforeOpeningMenu = signal<boolean>(false);

  private leaveSwal = viewChild<SwalComponent>('leaveSwal');
  protected anyModalOpen = computed(() => modalHasAnyOpen());
  protected isGamepadMode = computed(() => this.ffInput.mode() === 'gamepad');

  protected readonly decreeRevealLevel = DECREE_REVEAL_LEVEL;

  private readonly viewOpeners: Record<GamePlayView, () => void> = {
    world: () => this.changeGamePlayView('world'),
    town: () => this.openCurrentTown(),
    kingdom: () => this.setKingdomPlayView(),
    heroes: () => this.setHeroesPlayView(),
    adventurelog: () => this.changeGamePlayView('adventurelog'),
    decree: () => this.changeGamePlayView('decree'),
  };

  constructor() {
    const viewCycle = {
      enabled: () => isSetup() && !modalHasAnyOpen(),
      label: 'Switch View',
    };
    ffGamepadOn('tabPrev', () => this.cycleGamePlayView(-1), viewCycle);
    ffGamepadOn('tabNext', () => this.cycleGamePlayView(1), viewCycle);
    ffGamepadOn('menu', () => this.togglePauseMenu(), {
      enabled: () =>
        isSetup() && (modalIsTopmost('pause-menu') || !modalHasAnyOpen()),
      label: () => (modalIsTopmost('pause-menu') ? 'Resume' : 'Menu'),
    });
    ffGamepadOn('pause', () => this.togglePause(), {
      enabled: () => isSetup() && !modalHasAnyOpen(),
      label: () => (this.isPaused() ? 'Resume' : 'Pause'),
    });
    ffGamepadOn('back', () => void this.leaveSwal()?.fire(), {
      priority: GAMEPAD_PRIORITY.page,
      enabled: () => !isSetup(),
      label: 'Back',
    });
    ffGamepadOn('back', () => this.closePauseMenu(), {
      priority: GAMEPAD_PRIORITY.pauseMenu,
      enabled: () => modalIsTopmost('pause-menu'),
      label: 'Resume',
    });
  }

  public isPaused = computed(() => getOption('gameloopPaused'));
  public isFelDefeated = computed(() => isFelDefeated());

  public activeGamePlayView = computed(() => gamePlayView());

  public showRecenterButton = computed(
    () => this.activeGamePlayView() === 'world' && isWorldCameraPanned(),
  );

  public autoModeEnabled = computed(() => autoModeIsEnabled());

  public enabledClauses = computed(() =>
    decreeClauses().filter((clause) => clause.enabled),
  );

  public activeClauseId = computed(() => decreeActiveClauseId());

  protected clauseSummary = decreeClauseSummary;

  public recenterCamera() {
    worldCameraRecenter();
  }

  public showCaravanTradeButton = computed(() => {
    const entry = worldNodeAtCurrentLocation();
    return (
      !!entry && !!worldNodeCaravan(entry) && worldNodeCaravanIsAvailable(entry)
    );
  });

  public openCaravanTrade(): void {
    const entry = worldNodeAtCurrentLocation();
    if (!entry) return;

    caravanTradeOpen(entry);
  }

  // Aliases "Enter Town" - only shown while physically at the town's node, same gate as that button.
  public currentTownEntry = computed(() => {
    const entry = worldNodeAtCurrentLocation();
    return entry && worldNodeTown(entry) ? entry : undefined;
  });

  public currentTownName = computed(() => {
    const entry = this.currentTownEntry();
    return (entry ? worldNodeTown(entry)?.name : undefined) ?? 'Town';
  });

  public openCurrentTown(): void {
    const entry = this.currentTownEntry();
    if (!entry) return;

    navigationGuarded(() => townOpen(entry));
  }

  public currentTrainerEntry = computed(() => {
    const entry = worldNodeAtCurrentLocation();
    return entry && worldNodeTrainer(entry) ? entry : undefined;
  });

  public openCurrentTrainer(): void {
    const entry = this.currentTrainerEntry();
    if (!entry) return;

    trainerVisitOpen(entry);
  }

  public changeGamePlayView(view: GamePlayView): void {
    navigationGuarded(() => setGamePlayView(view));
  }

  public setHeroesPlayView(): void {
    navigationGuarded(() => {
      if (gamePlayView() === 'heroes') heroesSubviewClear();
      setGamePlayView('heroes');
    });
  }

  public setKingdomPlayView(): void {
    navigationGuarded(() => {
      if (gamePlayView() === 'kingdom' && kingdomSubview()) {
        kingdomSubviewClear();
      }
      setGamePlayView('kingdom');
    });
  }

  public readonly panelConfigs: Array<{
    name: string;
    icon: Icon;
    hotkey: string;
    clickCb: () => void;
  }> = [];

  public togglePause() {
    if (this.showPauseMenu()) return;
    setOption('gameloopPaused', !this.isPaused());
  }

  public goToHome() {
    saveGameState();
    closeAllMenus();
    this.router.navigate(['..']);
  }

  public closePauseMenu() {
    modalClose('pause-menu');
    if (!this.wasPausedBeforeOpeningMenu()) {
      setOption('gameloopPaused', false);
    }
  }

  public openPauseMenu() {
    if (!isSetup()) return;

    modalOpen('pause-menu');
    if (this.isPaused()) {
      this.wasPausedBeforeOpeningMenu.set(true);
    } else {
      this.wasPausedBeforeOpeningMenu.set(false);
      setOption('gameloopPaused', true);
    }
  }

  // Pause menu is special-cased (resuming has side effects); with nothing open, ESC opens the pause menu instead.
  public closeAllMenus() {
    if (this.closePauseMenuIfTopmost()) return;

    if (modalHasAnyOpen()) {
      modalCloseTop();
      return;
    }

    this.openPauseMenu();
  }

  private closePauseMenuIfTopmost(): boolean {
    if (!modalIsTopmost('pause-menu')) return false;

    this.closePauseMenu();
    return true;
  }

  private togglePauseMenu(): void {
    if (this.closePauseMenuIfTopmost()) return;
    this.openPauseMenu();
  }

  private cycleGamePlayView(direction: 1 | -1): void {
    const views = gamePlayViewsCyclable(
      !!this.currentTownEntry(),
      isRevealedAtLevel(DECREE_REVEAL_LEVEL),
    );
    this.viewOpeners[gamePlayViewStep(views, gamePlayView(), direction)]();
  }

  public toggleAutoMode(): void {
    autoModeToggle(!this.autoModeEnabled());
  }
}
