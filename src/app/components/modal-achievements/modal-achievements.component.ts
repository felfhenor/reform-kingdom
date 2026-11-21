import { FFFocusRowDirective } from '@ff/focus/ff-focus-row.directive';
import { FFButtonComponent } from '@ff/components/button/button.component';
import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { BarProgressComponent } from '@components/bar-progress/bar-progress.component';
import { IconUnknownComponent } from '@components/icon-unknown/icon-unknown.component';
import { ModalComponent } from '@components/modal/modal.component';
import { achievementsAll } from '@helpers/achievement/achievement';
import {
  achievementTiles,
  achievementsUnlockedCount,
} from '@helpers/achievement/achievement.ui';
import { modalCloseAll, modalIsOpen } from '@helpers/engine/modal-stack';
import { isSetup } from '@helpers/setup';
import type { GameId } from '@interfaces';

@Component({
  selector: 'app-modal-achievements',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FFFocusRowDirective,
    FFButtonComponent,
    AtlasImageComponent,
    BarProgressComponent,
    DatePipe,
    DecimalPipe,
    IconUnknownComponent,
    ModalComponent,
  ],
  templateUrl: './modal-achievements.component.html',
})
export class ModalAchievementsComponent {
  private router = inject(Router);

  // The modal stays mounted inside the pause menu, so live progress is only read while it's open.
  private isOpen = computed(() => modalIsOpen('achievements'));

  public tiles = computed(() =>
    this.isOpen() ? achievementTiles(isSetup()) : [],
  );
  public unlocked = computed(() =>
    this.isOpen() ? achievementsUnlockedCount() : 0,
  );
  public total = computed(() => achievementsAll().length);

  // Leaving mid-game would skip the pause menu's save-and-confirm, so runs only open from outside the game.
  public canViewRuns = computed(
    () => this.isOpen() && !this.router.url.startsWith('/game'),
  );

  public openRun(runId: GameId): void {
    modalCloseAll();
    void this.router.navigate(['/summary', runId]);
  }
}
