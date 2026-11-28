import { TPipe } from '@pipes/t.pipe';
import { FFFocusSkipDirective } from '@/app/ff/focus/ff-focus-skip.directive';
import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { PageBlankComponent } from '@components/page-blank/page-blank.component';
import { PanelHeroEquipmentComponent } from '@components/panel-hero-equipment/panel-hero-equipment.component';
import { PlayHeroesRegaliaComponent } from '@components/play-heroes-regalia/play-heroes-regalia.component';
import { PlayHeroesSkillTreeComponent } from '@components/play-heroes-skill-tree/play-heroes-skill-tree.component';
import { SlotButtonContainerComponent } from '@components/slot-button-container/slot-button-container.component';
import { TabsHeroComponent } from '@components/tabs-hero/tabs-hero.component';
import { FFButtonComponent } from '@ff/components/button/button.component';
import { gamepadBindHeroCycle } from '@helpers/engine/gamepad.ui';
import {
  heroesSelectCharacter,
  heroesSelectedCharacterId,
  heroesSubview,
} from '@helpers/engine/ui';
import { optimizeCharacterEquipment } from '@helpers/hero/character-equipment';
import { canModifyEquipment } from '@helpers/item/equipment';
import { worldPartyState } from '@helpers/state-game';
import type { CharacterId } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-game-play-heroes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TPipe,
    CardPageComponent,
    BlankSlateComponent,
    PanelHeroEquipmentComponent,
    PageBlankComponent,
    PlayHeroesRegaliaComponent,
    PlayHeroesSkillTreeComponent,
    SlotButtonContainerComponent,
    TabsHeroComponent,
    TippyDirective,
    FFFocusSkipDirective,
    FFButtonComponent,
  ],
  templateUrl: './game-play-heroes.component.html',
})
export class GamePlayHeroesComponent {
  public activeSubview = computed(() => heroesSubview());

  public party = computed(() => worldPartyState());

  public selectedCharacter = computed(
    () =>
      this.party().find(
        (character) => character.id === heroesSelectedCharacterId(),
      ) ?? this.party()[0],
  );

  public selectedCharacterId = computed(() => this.selectedCharacter()?.id);

  public equipmentModifiable = computed(() => canModifyEquipment());

  constructor() {
    gamepadBindHeroCycle(
      () => this.selectedCharacterId(),
      (id) => this.selectCharacter(id),
    );
  }

  public selectCharacter(characterId: CharacterId): void {
    heroesSelectCharacter(characterId);
  }

  optimizeAll() {
    worldPartyState().forEach((p) => {
      void optimizeCharacterEquipment(p.id);
    });
  }
}
