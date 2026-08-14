import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonGlowComponent } from '@components/button-glow/button-glow.component';
import { ButtonQuitComponent } from '@components/button-quit/button-quit.component';
import { ButtonSettingsComponent } from '@components/button-settings/button-settings.component';
import { ButtonUpdateComponent } from '@components/button-update/button-update.component';
import { ModalCaravanTradeComponent } from '@components/modal-caravan-trade/modal-caravan-trade.component';
import { IconComponent } from '@components/icon/icon.component';
import { ModalComponent } from '@components/modal/modal.component';
import { RequireNotSetupDirective } from '@directives/no-setup.directive';
import { RequireSetupDirective } from '@directives/require-setup.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { isSetup } from '@helpers/setup';
import { saveGameState } from '@helpers/state-game';
import { getOption, setOption } from '@helpers/state-options';
import {
  activeCaravanNode,
  caravanTradeClose,
  caravanTradeOpen,
  closeAllMenus,
  gamePlayView,
  isShowingAnyMenu,
  isWorldCameraPanned,
  setGamePlayView,
  showOptionsMenu,
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
  ],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent {
  public meta = inject(MetaService);
  public router = inject(Router);

  public showPauseMenu = signal<boolean>(false);
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

  public toggleOptions() {
    if (showOptionsMenu()) {
      showOptionsMenu.set(false);
      return;
    }

    closeAllMenus();
    showOptionsMenu.set(!showOptionsMenu());
  }

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
    this.showPauseMenu.set(false);
    if (!this.wasPausedBeforeOpeningMenu()) {
      setOption('gameloopPaused', false);
    }
  }

  public openPauseMenu() {
    if (!isSetup()) return;

    this.showPauseMenu.set(true);
    if (this.isPaused()) {
      this.wasPausedBeforeOpeningMenu.set(true);
    } else {
      this.wasPausedBeforeOpeningMenu.set(false);
      setOption('gameloopPaused', true);
    }
  }

  public closeAllMenus() {
    if (activeCaravanNode()) {
      caravanTradeClose();
      return;
    }

    if (showOptionsMenu()) {
      showOptionsMenu.set(false);
      return;
    }

    if (this.showPauseMenu()) {
      this.closePauseMenu();
      return;
    }

    if (!isShowingAnyMenu()) {
      this.openPauseMenu();
      return;
    }

    closeAllMenus(true);
  }
}
