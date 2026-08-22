import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonGlowComponent } from '@components/button-glow/button-glow.component';
import { ButtonQuitComponent } from '@components/button-quit/button-quit.component';
import { ButtonSettingsComponent } from '@components/button-settings/button-settings.component';
import { ButtonUpdateComponent } from '@components/button-update/button-update.component';
import { IconComponent } from '@components/icon/icon.component';
import { ModalCaravanTradeComponent } from '@components/modal-caravan-trade/modal-caravan-trade.component';
import { ModalComponent } from '@components/modal/modal.component';
import { RequireNotSetupDirective } from '@directives/no-setup.directive';
import { RequireSetupDirective } from '@directives/require-setup.directive';
import { SFXDirective } from '@directives/sfx.directive';
import {
  modalClose,
  modalCloseTop,
  modalHasAnyOpen,
  modalIsOpen,
  modalIsTopmost,
  modalOpen,
} from '@helpers/modal-stack';
import { hotkeyMatches } from '@helpers/hotkeys';
import { isSetup } from '@helpers/setup';
import { saveGameState } from '@helpers/state-game';
import { getOption, setOption } from '@helpers/state-options';
import {
  caravanTradeOpen,
  closeAllMenus,
  gamePlayView,
  isWorldCameraPanned,
  setGamePlayView,
  worldCameraRecenter,
} from '@helpers/ui';
import { worldNodeAtCurrentLocation } from '@helpers/world';
import { worldNodeCaravanIsAvailable } from '@helpers/world-node-caravan';
import { worldNodeCaravan } from '@helpers/world-nodes';
import type { GamePlayView, Icon } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import { HotkeysDirective } from '@ngneat/hotkeys';
import { MetaService } from '@services/meta.service';
import type { SwalComponent } from '@sweetalert2/ngx-sweetalert2';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';

import { BarResourceComponent } from '@components/bar-resource/bar-resource.component';
import { ButtonContentAnalysisComponent } from '../button-content-analysis/button-content-analysis.component';

@Component({
  selector: 'app-navbar',
  imports: [
    TippyDirective,
    RequireSetupDirective,
    IconComponent,
    SweetAlert2Module,
    SFXDirective,
    ButtonUpdateComponent,
    HotkeysDirective,
    RequireNotSetupDirective,
    ModalComponent,
    ButtonQuitComponent,
    ButtonSettingsComponent,
    ButtonGlowComponent,
    BarResourceComponent,
    ModalCaravanTradeComponent,
    ButtonContentAnalysisComponent,
  ],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent {
  public meta = inject(MetaService);
  public router = inject(Router);

  protected hotkeyMatches = hotkeyMatches;

  // "t"/"r" fire unfiltered on every keydown (see hotkeys.ts) - don't also eat other keys' defaults.
  protected readonly noPreventDefault = { preventDefault: false };

  public showPauseMenu = computed(() => modalIsOpen('pause-menu'));
  private wasPausedBeforeOpeningMenu = signal<boolean>(false);

  public leaveSwal = viewChild<SwalComponent>('leaveSwal');

  public isPaused = computed(() => getOption('gameloopPaused'));

  public activeGamePlayView = computed(() => gamePlayView());

  public showRecenterButton = computed(
    () => this.activeGamePlayView() === 'world' && isWorldCameraPanned(),
  );

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
    if (entry) caravanTradeOpen(entry);
  }

  public changeGamePlayView(view: GamePlayView): void {
    setGamePlayView(view);
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
    if (modalIsTopmost('pause-menu')) {
      this.closePauseMenu();
      return;
    }

    if (modalHasAnyOpen()) {
      modalCloseTop();
      return;
    }

    this.openPauseMenu();
  }
}
