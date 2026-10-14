import type { OnInit } from '@angular/core';
import { Component, computed } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from '@components/navbar/navbar.component';
import { ScreenTitleCrawlComponent } from '@components/screen-title-crawl/screen-title-crawl.component';
import { FadeInDirective } from '@directives/fade-in.directive';
import { discordUpdateStatus } from '@helpers/engine/discord';
import { isTitleCrawlPending } from '@helpers/lore/title-crawl';

@Component({
  selector: 'app-game',
  imports: [RouterOutlet, NavbarComponent, ScreenTitleCrawlComponent],
  hostDirectives: [FadeInDirective],
  templateUrl: './game.component.html',
  styleUrl: './game.component.scss',
})
export class GameComponent implements OnInit {
  public isTitleCrawlPending = computed(() => isTitleCrawlPending());

  ngOnInit() {
    discordUpdateStatus();
  }
}
