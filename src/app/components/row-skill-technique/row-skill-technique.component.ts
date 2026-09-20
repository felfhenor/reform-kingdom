import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import type { SkillTechniqueKind, SkillTechniquePreview } from '@interfaces';
import { StatShorthand } from '@interfaces';

const kindClasses: Record<SkillTechniqueKind, string> = {
  Damage: 'text-error',
  Heal: 'text-success',
  Buff: 'text-info',
  Debuff: 'text-warning',
  Effect: '',
};

@Component({
  selector: 'app-row-skill-technique',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  templateUrl: './row-skill-technique.component.html',
})
export class RowSkillTechniqueComponent {
  public technique = input.required<SkillTechniquePreview>();

  public statShorthand = StatShorthand;

  public kindClass = computed(() => kindClasses[this.technique().kind]);
  public kindLabel = computed(() => {
    const { elements, kind } = this.technique();
    return [...elements, kind].join(' ');
  });
  public statusVerb = computed(() =>
    this.technique().kind === 'Buff' ? 'Grants' : 'Inflicts',
  );
}
