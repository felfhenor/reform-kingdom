import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { HeroEquipmentPanelEquipmentComponent } from '@components/hero-equipment-panel-equipment/hero-equipment-panel-equipment.component';
import { HeroEquipmentPanelSkillsComponent } from '@components/hero-equipment-panel-skills/hero-equipment-panel-skills.component';
import { HeroEquipmentPanelStatsComponent } from '@components/hero-equipment-panel-stats/hero-equipment-panel-stats.component';
import { IconJobComponent } from '@components/icon-job/icon-job.component';
import { getEntry } from '@helpers';
import type { Character, JobContent } from '@interfaces';

@Component({
  selector: 'app-hero-equipment-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HeroEquipmentPanelEquipmentComponent,
    HeroEquipmentPanelSkillsComponent,
    HeroEquipmentPanelStatsComponent,
    IconJobComponent,
    DecimalPipe,
  ],
  templateUrl: './hero-equipment-panel.component.html',
  styleUrl: './hero-equipment-panel.component.scss',
})
export class HeroEquipmentPanelComponent {
  public character = input.required<Character>();

  public job = computed<JobContent | undefined>(() =>
    getEntry<JobContent>(this.character().jobId),
  );
}
