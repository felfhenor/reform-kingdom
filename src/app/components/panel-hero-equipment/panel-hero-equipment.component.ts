import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { ButtonHeroCombatOrdersComponent } from '@components/button-hero-combat-orders/button-hero-combat-orders.component';
import { ModalHeroCombatOrdersComponent } from '@components/modal-hero-combat-orders/modal-hero-combat-orders.component';
import { PanelHeroEquipmentEquipmentComponent } from '@components/panel-hero-equipment-equipment/panel-hero-equipment-equipment.component';
import { PanelHeroEquipmentSkillsComponent } from '@components/panel-hero-equipment-skills/panel-hero-equipment-skills.component';
import { PanelHeroEquipmentStatsComponent } from '@components/panel-hero-equipment-stats/panel-hero-equipment-stats.component';
import { IconJobComponent } from '@components/icon-job/icon-job.component';
import { getEntry } from '@helpers/content';
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
    ModalHeroCombatOrdersComponent,
  ],
  templateUrl: './panel-hero-equipment.component.html',
  styleUrl: './panel-hero-equipment.component.scss',
})
export class PanelHeroEquipmentComponent {
  public character = input.required<Character>();

  public job = computed<JobContent | undefined>(() =>
    getEntry<JobContent>(this.character().jobId),
  );
}
