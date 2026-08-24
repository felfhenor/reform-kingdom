import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { skillStatScaling } from '@helpers/hero/skill';
import { StatShorthand, type EquipmentSkillContent } from '@interfaces';
import { StatDisplayPipe } from '@pipes/stat-display.pipe';

@Component({
  selector: 'app-row-skill-stat-scaling',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatDisplayPipe],
  template: `
    @if (scaling().length > 0) {
      <div class="italic text-xs text-lighter">
        @for (entry of scaling(); track entry.stat; let last = $last) {
          {{ entry.multiplier | statDisplay: 2 : false }}x
          {{ statShorthand[entry.stat] }}{{ last ? '' : ' + ' }}
        }
      </div>
    }
  `,
})
export class RowSkillStatScalingComponent {
  public skill = input.required<EquipmentSkillContent>();

  public scaling = computed(() => skillStatScaling(this.skill()));
  public statShorthand = StatShorthand;
}
