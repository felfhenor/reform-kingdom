import { Component, computed } from '@angular/core';
import { RouterModule } from '@angular/router';

import { GamePlayKingdomComponent } from '@components/game-play-kingdom/game-play-kingdom.component';
import { GamePlayWorldComponent } from '@components/game-play-world/game-play-world.component';
import { HeroStatusComponent } from '@components/hero-status/hero-status.component';
import { OptionsBaseComponent } from '@components/panel-options/option-base-page.component';
import { PlayAdventureLogComponent } from '@components/play-adventurelog/play-adventurelog.component';
import { TeleportOutletDirective } from '@directives/teleport.outlet.directive';
import { gamePlayView, getOption } from '@helpers';

@Component({
  selector: 'app-game-play',
  imports: [
    RouterModule,
    TeleportOutletDirective,
    GamePlayWorldComponent,
    GamePlayKingdomComponent,
    PlayAdventureLogComponent,
    HeroStatusComponent,
  ],
  templateUrl: './game-play.component.html',
  styleUrl: './game-play.component.scss',
})
export class GamePlayComponent extends OptionsBaseComponent {
  public isPaused = computed(() => getOption('gameloopPaused'));
  public activeGamePlayView = computed(() => gamePlayView());
}
