import type { OnInit } from '@angular/core';
import { Component, computed } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CardDemoEndComponent } from '@components/card-demo-end/card-demo-end.component';
import { CardRunLostComponent } from '@components/card-run-lost/card-run-lost.component';
import { CardVictoryComponent } from '@components/card-victory/card-victory.component';
import { NavbarComponent } from '@components/navbar/navbar.component';
import { OverlayCombatOrdersComponent } from '@components/overlay-combat-orders/overlay-combat-orders.component';
import { combatManualOverlayVisible } from '@helpers/combat/combat-manual.ui';
import { ScreenTitleCrawlComponent } from '@components/screen-title-crawl/screen-title-crawl.component';
import { FadeInDirective } from '@directives/fade-in.directive';
import { isDemoEndPending } from '@helpers/demo/demo.ui';
import { discordUpdateStatus } from '@helpers/engine/discord';
import { windowAttentionBind } from '@helpers/engine/window-attention.ui';
import {
  isOutroCrawlPending,
  isRunLost,
  isVictoryPopupPending,
} from '@helpers/lore/outro';
import { outroCrawlParagraphs, outroCrawlFinish } from '@helpers/lore/outro.ui';
import { isTitleCrawlPending } from '@helpers/lore/title-crawl';
import {
  titleCrawlParagraphs,
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
    CardDemoEndComponent,
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
  public isDemoEndPending = computed(() => isDemoEndPending());

  public titleCrawlParagraphs = titleCrawlParagraphs();
  public outroCrawlParagraphs = outroCrawlParagraphs();

  constructor() {
    windowAttentionBind();
  }

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
