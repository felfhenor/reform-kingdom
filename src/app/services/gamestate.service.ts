import {
  ApplicationRef,
  effect,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import {
  gameloop,
  gamestate,
  getOption,
  hasGameStateLoaded,
  isGameStateReady,
  isPageVisible,
  migrateGameState,
  migrateOptionsState,
} from '@helpers';
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

  public hasLoaded = signal<boolean>(false);

  constructor() {
    effect(() => {
      if (
        !this.contentService.hasLoaded() ||
        this.hasLoaded() ||
        !hasGameStateLoaded()
      )
        return;
      this.logger.info('GameState', 'Migrating gamestate...');

      migrateGameState();
      migrateOptionsState();

      this.logger.info('GameState', 'Gamestate migrated & loaded.');
      this.hasLoaded.set(true);
      isGameStateReady.set(true);
    });

    effect(() => {
      if (!this.hasLoaded()) return;

      const state = gamestate();

      if (getOption('debugConsoleLogStateUpdates')) {
        this.logger.debug('GameState Update', state);
      }
    });
  }

  init() {
    this.doGameloop();
  }

  private doGameloop() {
    let lastRunTime = 0;

    const applicationRef = this.applicationRef;

    // `gameloop` mutates gamestate signals from a background RxJS interval,
    // outside any Angular-tracked call stack. In this zoneless app nothing
    // else notices that write happened, so templates/effects reading that
    // state (health bars, global effect timers, etc.) can silently go stale
    // until something else happens to trigger change detection. Forcing a
    // tick here after every gameloop batch is the documented escape hatch
    // for exactly this "background async work changed signals" case.
    async function runLoop(numTicks: number) {
      lastRunTime = Date.now();
      await gameloop(numTicks);
      applicationRef.tick();
    }

    void runLoop(1);

    interval(1000).subscribe(() => {
      if (lastRunTime <= 0 || !this.hasLoaded()) return;

      if (!isPageVisible() && !getOption('debugAllowBackgroundOperations')) {
        return;
      }

      const secondsElapsed = Math.round((Date.now() - lastRunTime) / 1000);

      runLoop(secondsElapsed);
    });
  }
}
