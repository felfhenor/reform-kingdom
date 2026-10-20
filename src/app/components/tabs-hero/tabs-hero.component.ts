import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { BadgeSkillPointsComponent } from '@components/badge-skill-points/badge-skill-points.component';
import { IconJobComponent } from '@components/icon-job/icon-job.component';
import { LabelJobComponent } from '@components/label-job/label-job.component';
import { SFXDirective } from '@directives/sfx.directive';
import { getEntry } from '@helpers/content/content';
import type { Character, CharacterId, JobContent, JobId } from '@interfaces';

@Component({
  selector: 'app-tabs-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BadgeSkillPointsComponent,
    IconJobComponent,
    LabelJobComponent,
    SFXDirective,
  ],
  templateUrl: './tabs-hero.component.html',
  styleUrl: './tabs-hero.component.scss',
})
export class TabsHeroComponent {
  public party = input.required<Character[]>();
  public selectedId = input<CharacterId>();
  public selected = output<CharacterId>();

  public jobFor(jobId: JobId): JobContent | undefined {
    return getEntry<JobContent>(jobId);
  }
}
