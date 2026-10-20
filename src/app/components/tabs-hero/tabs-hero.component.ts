import type { AnimationCallbackEvent } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { IconJobComponent } from '@components/icon-job/icon-job.component';
import { LabelJobComponent } from '@components/label-job/label-job.component';
import { SFXDirective } from '@directives/sfx.directive';
import { getEntry } from '@helpers/content/content';
import { characterSkillTreeAvailableSp } from '@helpers/hero/skill-tree';
import { AnimationService } from '@services/animation.service';
import type { Character, CharacterId, JobContent, JobId } from '@interfaces';

@Component({
  selector: 'app-tabs-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, IconJobComponent, LabelJobComponent, SFXDirective],
  templateUrl: './tabs-hero.component.html',
  styleUrl: './tabs-hero.component.scss',
})
export class TabsHeroComponent {
  private anim = inject(AnimationService);
  public party = input.required<Character[]>();
  public selectedId = input<CharacterId>();
  public selected = output<CharacterId>();

  public jobFor(jobId: JobId): JobContent | undefined {
    return getEntry<JobContent>(jobId);
  }

  public freeSp(character: Character): number {
    return characterSkillTreeAvailableSp(character, character.jobId);
  }

  public onEnter(event: AnimationCallbackEvent): void {
    this.anim.popIn(event.target);
  }

  public onLeave(event: AnimationCallbackEvent): void {
    this.anim
      .fadeOut(event.target)
      .then(() => event.animationComplete())
      .catch(() => event.animationComplete());
  }
}
