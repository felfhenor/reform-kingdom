import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { IconJobComponent } from '@components/icon-job/icon-job.component';
import { PanelHeroEquipmentComponent } from '@components/panel-hero-equipment/panel-hero-equipment.component';
import { getEntry } from '@helpers/content';
import { partyGet } from '@helpers/hero/party';
import type { CharacterId, JobContent, JobId } from '@interfaces';

@Component({
  selector: 'app-game-play-heroes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardPageComponent,
    BlankSlateComponent,
    PanelHeroEquipmentComponent,
    IconJobComponent,
  ],
  templateUrl: './game-play-heroes.component.html',
  styleUrl: './game-play-heroes.component.scss',
})
export class GamePlayHeroesComponent {
  public party = computed(() => partyGet());

  private explicitSelectedId = signal<CharacterId | undefined>(undefined);

  public selectedCharacterId = computed(
    () => this.explicitSelectedId() ?? this.party()[0]?.id,
  );

  public selectedCharacter = computed(() =>
    this.party().find(
      (character) => character.id === this.selectedCharacterId(),
    ),
  );

  public jobFor(jobId: JobId): JobContent | undefined {
    return getEntry<JobContent>(jobId);
  }

  public selectCharacter(characterId: CharacterId): void {
    this.explicitSelectedId.set(characterId);
  }
}
