import type { OnInit } from '@angular/core';
import { Component, computed } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CardRunLostComponent } from '@components/card-run-lost/card-run-lost.component';
import { CardVictoryComponent } from '@components/card-victory/card-victory.component';
import { NavbarComponent } from '@components/navbar/navbar.component';
import { OverlayCombatOrdersComponent } from '@components/overlay-combat-orders/overlay-combat-orders.component';
import { combatManualOverlayVisible } from '@helpers/combat/combat-manual.ui';
import { ScreenTitleCrawlComponent } from '@components/screen-title-crawl/screen-title-crawl.component';
import { FadeInDirective } from '@directives/fade-in.directive';
import { discordUpdateStatus } from '@helpers/engine/discord';
import {
  isOutroCrawlPending,
  isRunLost,
  isVictoryPopupPending,
} from '@helpers/lore/outro';
import {
  OUTRO_CRAWL_PARAGRAPHS,
  outroCrawlFinish,
} from '@helpers/lore/outro.ui';
import { isTitleCrawlPending } from '@helpers/lore/title-crawl';
import {
  TITLE_CRAWL_PARAGRAPHS,
  titleCrawlFinish,
} from '@helpers/lore/title-crawl.ui';

@Component({
  selector: 'app-game',
  imports: [
    OverlayCombatOrdersComponent,
    RouterOutlet,
    NavbarComponent,
    ScreenTitleCrawlComponent,
    CardVictoryComponent,
    CardRunLostComponent,
  ],
  hostDirectives: [FadeInDirective],
  templateUrl: './game.component.html',
  styleUrl: './game.component.scss',
})
export class GameComponent implements OnInit {
  public isTitleCrawlPending = computed(() => isTitleCrawlPending());
  public isOutroCrawlPending = computed(() => isOutroCrawlPending());
  public isVictoryPopupPending = computed(() => isVictoryPopupPending());
  public isManualCombat = computed(() => combatManualOverlayVisible());
  public isRunLost = computed(() => isRunLost());

  public titleCrawlParagraphs = TITLE_CRAWL_PARAGRAPHS;
  public outroCrawlParagraphs = OUTRO_CRAWL_PARAGRAPHS;

  ngOnInit() {
    discordUpdateStatus();
  }

  public titleCrawlFinish(wasSkipped: boolean): void {
    void titleCrawlFinish(wasSkipped);
  }

  public outroCrawlFinish(wasSkipped: boolean): void {
    void outroCrawlFinish(wasSkipped);
  }
}
