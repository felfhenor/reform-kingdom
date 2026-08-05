import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { PlayKingdomAchievementsComponent } from '@components/play-kingdom-achievements/play-kingdom-achievements.component';
import { PlayKingdomArmoryComponent } from '@components/play-kingdom-armory/play-kingdom-armory.component';
import { PlayKingdomAstralProjectorComponent } from '@components/play-kingdom-astralprojector/play-kingdom-astralprojector.component';
import { PlayKingdomMuseumComponent } from '@components/play-kingdom-museum/play-kingdom-museum.component';
import { PlayKingdomPrestigeComponent } from '@components/play-kingdom-prestige/play-kingdom-prestige.component';
import { PlayKingdomReclassModalComponent } from '@components/play-kingdom-reclass-modal/play-kingdom-reclass-modal.component';
import { PlayKingdomStorageComponent } from '@components/play-kingdom-storage/play-kingdom-storage.component';
import { PlayKingdomTradeskillArtificingComponent } from '@components/play-kingdom-tradeskill-artificing/play-kingdom-tradeskill-artificing.component';
import { PlayKingdomTradeskillBlacksmithingComponent } from '@components/play-kingdom-tradeskill-blacksmithing/play-kingdom-tradeskill-blacksmithing.component';
import { PlayKingdomTradeskillJewelcraftingComponent } from '@components/play-kingdom-tradeskill-jewelcrafting/play-kingdom-tradeskill-jewelcrafting.component';
import { PlayKingdomTradeskillTailoringComponent } from '@components/play-kingdom-tradeskill-tailoring/play-kingdom-tradeskill-tailoring.component';
import { PlayKingdomTradeskillWoodworkingComponent } from '@components/play-kingdom-tradeskill-woodworking/play-kingdom-tradeskill-woodworking.component';
import {
  armoryGet,
  gamestate,
  getMuseumCollectibleEntries,
  isPlayerAtKingdom,
  kingdomSubview,
  kingdomSubviewShow,
  showReclassHeroesModal,
} from '@helpers';
import type { KingdomSubview } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import { PluralizePipe } from '../../pipes/pluralize.pipe';

interface TradeskillButton {
  subview: KingdomSubview;
  label: string;
}

@Component({
  selector: 'app-game-play-kingdom',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardPageComponent,
    TippyDirective,
    PluralizePipe,
    PlayKingdomStorageComponent,
    PlayKingdomMuseumComponent,
    PlayKingdomArmoryComponent,
    PlayKingdomAstralProjectorComponent,
    PlayKingdomTradeskillArtificingComponent,
    PlayKingdomTradeskillBlacksmithingComponent,
    PlayKingdomTradeskillJewelcraftingComponent,
    PlayKingdomTradeskillTailoringComponent,
    PlayKingdomTradeskillWoodworkingComponent,
    PlayKingdomAchievementsComponent,
    PlayKingdomPrestigeComponent,
    PlayKingdomReclassModalComponent,
  ],
  templateUrl: './game-play-kingdom.component.html',
})
export class GamePlayKingdomComponent {
  public activeSubview = computed(() => kingdomSubview());
  public canReclass = computed(() => isPlayerAtKingdom());

  public materialCount = computed(
    () => Object.keys(gamestate().materials).length,
  );

  public armoryCount = computed(() => armoryGet().length);

  public museumCollectibleEntries = computed(() => getMuseumCollectibleEntries());

  public museumCollectiblesFound = computed(
    () => this.museumCollectibleEntries().filter((entry) => entry.discovered)
      .length,
  );

  public readonly tradeskillButtons: TradeskillButton[] = [
    { subview: 'tradeskill-artificing', label: 'Artificing' },
    { subview: 'tradeskill-blacksmithing', label: 'Blacksmithing' },
    { subview: 'tradeskill-jewelcrafting', label: 'Jewelcrafting' },
    { subview: 'tradeskill-tailoring', label: 'Tailoring' },
    { subview: 'tradeskill-woodworking', label: 'Woodworking' },
  ];

  public openSubview(subview: KingdomSubview): void {
    kingdomSubviewShow(subview);
  }

  public openReclassModal(): void {
    if (!this.canReclass()) return;
    showReclassHeroesModal.set(true);
  }
}
