import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { BarProgressComponent } from '@components/bar-progress/bar-progress.component';
import { ButtonHeroCombatOrdersComponent } from '@components/button-hero-combat-orders/button-hero-combat-orders.component';
import { ButtonHeroTeachingsComponent } from '@components/button-hero-teachings/button-hero-teachings.component';
import { IconJobComponent } from '@components/icon-job/icon-job.component';
import { ModalHeroCombatOrdersComponent } from '@components/modal-hero-combat-orders/modal-hero-combat-orders.component';
import { ModalHeroTeachingsComponent } from '@components/modal-hero-teachings/modal-hero-teachings.component';
import { PanelHeroEquipmentEquipmentComponent } from '@components/panel-hero-equipment-equipment/panel-hero-equipment-equipment.component';
import { PanelHeroEquipmentSkillsComponent } from '@components/panel-hero-equipment-skills/panel-hero-equipment-skills.component';
import { PanelHeroEquipmentStatsComponent } from '@components/panel-hero-equipment-stats/panel-hero-equipment-stats.component';
import { SlotButtonContainerComponent } from '@components/slot-button-container/slot-button-container.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { HideUntilLevelDirective } from '@directives/hide-until-level.directive';
import { getEntry } from '@helpers/content/content';
import { demoteHero, promoteHero } from '@helpers/hero/position-swapping';
import { isPlayerAtKingdom, worldPartyState } from '@helpers/index';
import { isAnyTrainerDiscovered } from '@helpers/trainer/trainer';
import type { Character, JobContent } from '@interfaces';

@Component({
  selector: 'app-panel-hero-equipment',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PanelHeroEquipmentEquipmentComponent,
    PanelHeroEquipmentSkillsComponent,
    PanelHeroEquipmentStatsComponent,
    IconJobComponent,
    DecimalPipe,
    ButtonHeroCombatOrdersComponent,
    ButtonHeroTeachingsComponent,
    ModalHeroCombatOrdersComponent,
    ModalHeroTeachingsComponent,
    BarProgressComponent,
    SlotIconBlankComponent,
    HideUntilLevelDirective,
    SlotButtonContainerComponent,
  ],
  templateUrl: './panel-hero-equipment.component.html',
  styleUrl: './panel-hero-equipment.component.scss',
})
export class PanelHeroEquipmentComponent {
  public isAtKingdomCurrently = computed(() => isPlayerAtKingdom());
  public teachingsUnlocked = computed(() => isAnyTrainerDiscovered());
  public canPromote = computed(
    () => worldPartyState()[0].id !== this.character().id,
  );
  public canDemote = computed(
    () => worldPartyState()[3].id !== this.character().id,
  );

  public character = input.required<Character>();

  public job = computed<JobContent | undefined>(() =>
    getEntry<JobContent>(this.character().jobId),
  );

  promote() {
    promoteHero(this.character());
  }

  demote() {
    demoteHero(this.character());
  }
}
