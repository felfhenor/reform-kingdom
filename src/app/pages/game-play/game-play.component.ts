import { Component, computed } from '@angular/core';
import { RouterModule } from '@angular/router';

import { GamePlayDecreeComponent } from '@components/game-play-decree/game-play-decree.component';
import { GamePlayHeroesComponent } from '@components/game-play-heroes/game-play-heroes.component';
import { GamePlayKingdomComponent } from '@components/game-play-kingdom/game-play-kingdom.component';
import { GamePlayWorldComponent } from '@components/game-play-world/game-play-world.component';
import { IconComponent } from '@components/icon/icon.component';
import { OptionsBaseComponent } from '@components/panel-options/option-base-page.component';
import { PlayAdventureLogComponent } from '@components/play-adventurelog/play-adventurelog.component';
import { TeleportOutletDirective } from '@directives/teleport.outlet.directive';
import { getOption } from '@helpers/state-options';
import { gamePlayView } from '@helpers/ui';

@Component({
  selector: 'app-game-play',
  imports: [
    RouterModule,
    TeleportOutletDirective,
    GamePlayWorldComponent,
    GamePlayKingdomComponent,
    GamePlayHeroesComponent,
    PlayAdventureLogComponent,
    GamePlayDecreeComponent,
    IconComponent,
  ],
  templateUrl: './game-play.component.html',
  styleUrl: './game-play.component.scss',
})
export class GamePlayComponent extends OptionsBaseComponent {
  public isPaused = computed(() => getOption('gameloopPaused'));
  public activeGamePlayView = computed(() => gamePlayView());
}
