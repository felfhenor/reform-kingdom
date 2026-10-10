import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { IconElementChargeComponent } from '@components/icon-element-charge/icon-element-charge.component';
import { TippyDirective } from '@ngneat/helipopper';
import type { SkillTechniqueKind, SkillTechniquePreview } from '@interfaces';
import { StatShorthand } from '@interfaces';

const kindClasses: Record<SkillTechniqueKind, string> = {
  Damage: 'text-error',
  Heal: 'text-success',
  Restore: 'text-success',
  Buff: 'text-info',
  Debuff: 'text-warning',
  Effect: '',
  Summon: 'text-info',
};

@Component({
  selector: 'app-row-skill-technique',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, IconElementChargeComponent, TippyDirective],
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
