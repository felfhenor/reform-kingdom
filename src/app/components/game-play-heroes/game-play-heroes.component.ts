import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { IconJobComponent } from '@components/icon-job/icon-job.component';
import { PanelHeroEquipmentComponent } from '@components/panel-hero-equipment/panel-hero-equipment.component';
import { SlotButtonContainerComponent } from '@components/slot-button-container/slot-button-container.component';
import { SFXDirective } from '@directives/sfx.directive';
import { getEntry } from '@helpers/content/content';
import {
  heroesSelectCharacter,
  heroesSelectedCharacterId,
} from '@helpers/engine/ui';
import { optimizeCharacterEquipment } from '@helpers/hero/character-equipment';
import { canModifyEquipment } from '@helpers/item/equipment';
import { worldPartyState } from '@helpers/state-game';
import type { CharacterId, JobContent, JobId } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-game-play-heroes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardPageComponent,
    BlankSlateComponent,
    PanelHeroEquipmentComponent,
    IconJobComponent,
    SFXDirective,
    SlotButtonContainerComponent,
    TippyDirective,
  ],
  templateUrl: './game-play-heroes.component.html',
  styleUrl: './game-play-heroes.component.scss',
})
export class GamePlayHeroesComponent {
  public party = computed(() => worldPartyState());

  public selectedCharacter = computed(
    () =>
      this.party().find(
        (character) => character.id === heroesSelectedCharacterId(),
      ) ?? this.party()[0],
  );

  public selectedCharacterId = computed(() => this.selectedCharacter()?.id);

  public equipmentModifiable = computed(() => canModifyEquipment());

  public jobFor(jobId: JobId): JobContent | undefined {
    return getEntry<JobContent>(jobId);
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
