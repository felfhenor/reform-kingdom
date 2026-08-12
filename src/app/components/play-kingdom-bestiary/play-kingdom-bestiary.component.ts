import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { AtlasAnimationComponent } from '@components/atlas-animation/atlas-animation.component';
import { BestiaryMonsterDetailComponent } from '@components/bestiary-monster-detail/bestiary-monster-detail.component';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { IconUnknownComponent } from '@components/icon-unknown/icon-unknown.component';
import { KingdomBackButtonComponent } from '@components/kingdom-back-button/kingdom-back-button.component';
import { filterBestiaryEntries, getBestiaryEntries } from '@helpers';
import type { MonsterId } from '@interfaces';

@Component({
  selector: 'app-play-kingdom-bestiary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasAnimationComponent,
    BestiaryMonsterDetailComponent,
    CardPageComponent,
    IconUnknownComponent,
    KingdomBackButtonComponent,
  ],
  templateUrl: './play-kingdom-bestiary.component.html',
  styleUrl: './play-kingdom-bestiary.component.scss',
})
export class PlayKingdomBestiaryComponent {
  public searchText = signal('');
  public selectedMonsterId = signal<MonsterId | undefined>(undefined);

  public entries = computed(() => getBestiaryEntries());
  public discoveredCount = computed(
    () => this.entries().filter((entry) => entry.discovered).length,
  );

  public filteredEntries = computed(() =>
    filterBestiaryEntries(this.entries(), this.searchText()),
  );

  public selectedEntry = computed(() => {
    const filtered = this.filteredEntries();
    const selectedId = this.selectedMonsterId();

    return (
      filtered.find((entry) => entry.monster.id === selectedId) ?? filtered[0]
    );
  });

  public onSearchInput(event: Event): void {
    this.searchText.set((event.target as HTMLInputElement).value);
  }

  public selectMonster(monsterId: MonsterId): void {
    this.selectedMonsterId.set(monsterId);
  }
}
