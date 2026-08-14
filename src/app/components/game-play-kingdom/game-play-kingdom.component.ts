import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { ModalPlayKingdomReclassComponent } from '@components/modal-play-kingdom-reclass/modal-play-kingdom-reclass.component';
import { PlayKingdomAchievementsComponent } from '@components/play-kingdom-achievements/play-kingdom-achievements.component';
import { PlayKingdomArmoryComponent } from '@components/play-kingdom-armory/play-kingdom-armory.component';
import { PlayKingdomAstralProjectorComponent } from '@components/play-kingdom-astralprojector/play-kingdom-astralprojector.component';
import { PlayKingdomBestiaryComponent } from '@components/play-kingdom-bestiary/play-kingdom-bestiary.component';
import { PlayKingdomHomeComponent } from '@components/play-kingdom-home/play-kingdom-home.component';
import { PlayKingdomInfusionComponent } from '@components/play-kingdom-infusion/play-kingdom-infusion.component';
import { PlayKingdomMuseumComponent } from '@components/play-kingdom-museum/play-kingdom-museum.component';
import { PlayKingdomPrestigeComponent } from '@components/play-kingdom-prestige/play-kingdom-prestige.component';
import { PlayKingdomStorageComponent } from '@components/play-kingdom-storage/play-kingdom-storage.component';
import { PlayKingdomTradeskillArtificingComponent } from '@components/play-kingdom-tradeskill-artificing/play-kingdom-tradeskill-artificing.component';
import { PlayKingdomTradeskillBlacksmithingComponent } from '@components/play-kingdom-tradeskill-blacksmithing/play-kingdom-tradeskill-blacksmithing.component';
import { PlayKingdomTradeskillJewelcraftingComponent } from '@components/play-kingdom-tradeskill-jewelcrafting/play-kingdom-tradeskill-jewelcrafting.component';
import { PlayKingdomTradeskillTailoringComponent } from '@components/play-kingdom-tradeskill-tailoring/play-kingdom-tradeskill-tailoring.component';
import { PlayKingdomTradeskillWoodworkingComponent } from '@components/play-kingdom-tradeskill-woodworking/play-kingdom-tradeskill-woodworking.component';
import { kingdomSubview } from '@helpers/ui';

@Component({
  selector: 'app-game-play-kingdom',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PlayKingdomHomeComponent,
    PlayKingdomStorageComponent,
    PlayKingdomMuseumComponent,
    PlayKingdomArmoryComponent,
    PlayKingdomAstralProjectorComponent,
    PlayKingdomBestiaryComponent,
    PlayKingdomInfusionComponent,
    PlayKingdomTradeskillArtificingComponent,
    PlayKingdomTradeskillBlacksmithingComponent,
    PlayKingdomTradeskillJewelcraftingComponent,
    PlayKingdomTradeskillTailoringComponent,
    PlayKingdomTradeskillWoodworkingComponent,
    PlayKingdomAchievementsComponent,
    PlayKingdomPrestigeComponent,
    ModalPlayKingdomReclassComponent,
  ],
  templateUrl: './game-play-kingdom.component.html',
})
export class GamePlayKingdomComponent {
  public activeSubview = computed(() => kingdomSubview());
}
