import {
  ApplicationRef,
  DestroyRef,
  effect,
  inject,
  Injectable,
  signal,
  untracked,
} from '@angular/core';
import { GAMELOOP_INTERVAL_MS } from '@helpers/config';
import { electronWindowOnSaveBeforeClose } from '@helpers/engine/electron-window.ui';
import { notifyError } from '@helpers/engine/notify';
import { isPageVisible } from '@helpers/engine/page-visibility';
import { gameloop } from '@helpers/gameloop';
import { migrateOptionsState } from '@helpers/migrate';
import { savefileLoad } from '@helpers/savefile/savefile-load';
import {
  gamestate,
  hasGameStateLoaded,
  isGameStateReady,
  saveGameState,
} from '@helpers/state-game';
import { getOption } from '@helpers/state-options';
import { townReputationBuffReconcile } from '@helpers/town/reputation/town-reputation-buff.ui';
import { ContentService } from '@services/content.service';
import { LoggerService } from '@services/logger.service';
import { interval } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class GamestateService {
  private logger = inject(LoggerService);
  private contentService = inject(ContentService);
  private applicationRef = inject(ApplicationRef);
  private destroyRef = inject(DestroyRef);

  public hasLoaded = signal<boolean>(false);

  private isLoadingSavefile = false;

  constructor() {
    effect(() => {
      if (
        !this.contentService.hasLoaded() ||
        this.hasLoaded() ||
        !hasGameStateLoaded() ||
        this.isLoadingSavefile
      )
        return;

      this.isLoadingSavefile = true;
      untracked(() => void this.loadSavefile());
    });

    effect(() => {
      if (!this.hasLoaded()) return;

      const state = gamestate();

      if (getOption('debugConsoleLogStateUpdates')) {
        this.logger.debug('GameState Update', state);
      }
    });
  }

  private async loadSavefile() {
    this.logger.info('GameState', 'Migrating gamestate...');

    await savefileLoad();
    migrateOptionsState();

    // The normal sync hook never runs on load, so town-region buffs need re-deriving here.
    townReputationBuffReconcile(gamestate().world.currentLocation.mapName);

    this.logger.info('GameState', 'Gamestate loaded.');
    this.hasLoaded.set(true);
    isGameStateReady.set(true);
  }

  init() {
    this.doGameloop();
    this.saveWhenHidden();
    this.saveBeforeClose();
  }

  // Minimizing or switching away may be the last chance to save, so don't wait for the next autosave.
  private saveWhenHidden() {
    const onVisibilityChange = () => {
      if (!isPageVisible() && isGameStateReady()) saveGameState();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    this.destroyRef.onDestroy(() =>
      document.removeEventListener('visibilitychange', onVisibilityChange),
    );
  }

  private saveBeforeClose() {
    const stop = electronWindowOnSaveBeforeClose(async () => {
      if (!isGameStateReady()) return true;

      const saved = await saveGameState();
      if (!saved) {
        notifyError(
          'Your game could not be saved. Close again to quit without saving.',
        );
      }
      return saved;
    });
    this.destroyRef.onDestroy(() => stop?.());
  }

  private doGameloop() {
    let lastRunTime = 0;
    // gameloop() itself now no-ops on overlap, but this also stops lastRunTime from advancing mid-catch-up, so elapsed time isn't silently dropped.
    let isRunning = false;

    const applicationRef = this.applicationRef;

    // `gameloop` mutates signals from a background RxJS interval, untracked in this zoneless app - force a tick so stale UI (health bars, timers) refreshes.
    async function runLoop(numTicks: number) {
      lastRunTime = Date.now();
      isRunning = true;
      try {
        await gameloop(numTicks);
      } finally {
        isRunning = false;
      }
      applicationRef.tick();
    }

    void runLoop(1);

    interval(GAMELOOP_INTERVAL_MS).subscribe(() => {
      if (lastRunTime <= 0 || !this.hasLoaded() || isRunning) return;

      if (!isPageVisible() && !getOption('runInBackground')) {
        return;
      }

      const secondsElapsed = Math.round((Date.now() - lastRunTime) / 1000);

      runLoop(secondsElapsed);
    });
  }
}
