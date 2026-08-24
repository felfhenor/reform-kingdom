import {
  ApplicationRef,
  effect,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { isPageVisible } from '@helpers/engine/ui';
import { gameloop } from '@helpers/gameloop';
import { migrateGameState, migrateOptionsState } from '@helpers/migrate';
import {
  gamestate,
  hasGameStateLoaded,
  isGameStateReady,
} from '@helpers/state-game';
import { getOption } from '@helpers/state-options';
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

    // `gameloop` mutates signals from a background RxJS interval, untracked in this zoneless app - force a tick so stale UI (health bars, timers) refreshes.
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
