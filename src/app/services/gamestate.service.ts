import { effect, inject, Injectable, signal } from '@angular/core';
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

    function runLoop(numTicks: number) {
      lastRunTime = Date.now();
      gameloop(numTicks);
    }

    runLoop(1);

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
