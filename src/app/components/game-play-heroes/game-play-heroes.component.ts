import {
  ChangeDetectionStrategy,
  Component,
  computed,
  viewChild,
} from '@angular/core';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { IconJobComponent } from '@components/icon-job/icon-job.component';
import { PageBlankComponent } from '@components/page-blank/page-blank.component';
import { PanelHeroEquipmentComponent } from '@components/panel-hero-equipment/panel-hero-equipment.component';
import { PlayHeroesRegaliaComponent } from '@components/play-heroes-regalia/play-heroes-regalia.component';
import { SlotButtonContainerComponent } from '@components/slot-button-container/slot-button-container.component';
import { HideUntilLevelDirective } from '@directives/hide-until-level.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { getEntry } from '@helpers/content/content';
import {
  heroesSelectCharacter,
  heroesSelectedCharacterId,
  heroesSubview,
  regaliaPageOpen,
} from '@helpers/engine/ui';
import { optimizeCharacterEquipment } from '@helpers/hero/character-equipment';
import {
  characterCurrentRegalia,
  regaliaMatchesCharacter,
} from '@helpers/hero/regalia';
import { regaliaUpdate } from '@helpers/hero/regalia.ui';
import { canModifyEquipment } from '@helpers/item/equipment';
import { regaliasState, worldPartyState } from '@helpers/state-game';
import type { CharacterId, JobContent, JobId } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import type { SwalComponent } from '@sweetalert2/ngx-sweetalert2';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';

@Component({
  selector: 'app-game-play-heroes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardPageComponent,
    BlankSlateComponent,
    PanelHeroEquipmentComponent,
    IconJobComponent,
    HideUntilLevelDirective,
    PageBlankComponent,
    PlayHeroesRegaliaComponent,
    SFXDirective,
    SweetAlert2Module,
    SlotButtonContainerComponent,
    TippyDirective,
  ],
  templateUrl: './game-play-heroes.component.html',
  styleUrl: './game-play-heroes.component.scss',
})
export class GamePlayHeroesComponent {
  private regaliaUpdateSwal = viewChild<SwalComponent>('regaliaUpdateSwal');

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

  public currentRegalia = computed(() => {
    const character = this.selectedCharacter();
    return character
      ? characterCurrentRegalia(regaliasState().entries, character)
      : undefined;
  });

  public regaliaMatches = computed(() => {
    const character = this.selectedCharacter();
    const regalia = this.currentRegalia();
    return (
      !!character && !!regalia && regaliaMatchesCharacter(regalia, character)
    );
  });

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

  public openRegalias(characterId: CharacterId): void {
    regaliaPageOpen(characterId);
  }

  public requestRegaliaUpdate(skipConfirm = false): void {
    if (skipConfirm) {
      this.confirmRegaliaUpdate();
      return;
    }

    void this.regaliaUpdateSwal()?.fire();
  }

  public confirmRegaliaUpdate(): void {
    const character = this.selectedCharacter();
    if (character && !this.regaliaMatches()) void regaliaUpdate(character.id);
  }
}
