import { computed, inject, Injectable } from '@angular/core';
import { hasGameStateLoaded, loadingProgressCalculate } from '@helpers';
import { ContentService } from '@services/content.service';
import { GamestateService } from '@services/gamestate.service';

@Injectable({
  providedIn: 'root',
})
export class LoadingService {
  private contentService = inject(ContentService);
  private gamestateService = inject(GamestateService);

  public progress = computed(() =>
    loadingProgressCalculate([
      { label: 'Loading game data...', isDone: this.contentService.hasLoadedData() },
      { label: 'Loading artwork...', isDone: this.contentService.hasLoadedArt() },
      { label: 'Loading maps...', isDone: this.contentService.hasLoadedMaps() },
      { label: 'Loading your save...', isDone: hasGameStateLoaded() },
      {
        label: 'Preparing your kingdom...',
        isDone: this.gamestateService.hasLoaded(),
      },
    ]),
  );

  public isReady = computed(() => this.progress().isComplete);
}
