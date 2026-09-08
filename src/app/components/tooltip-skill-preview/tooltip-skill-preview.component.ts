import type { TemplateRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  viewChild,
} from '@angular/core';
import type {
  Combatant,
  EquipmentItemType,
  EquipmentSkillContent,
} from '@interfaces';

import { IconItemPreviewComponent } from '@components/icon-item-preview/icon-item-preview.component';
import { RowSkillStatScalingComponent } from '@components/row-skill-stat-scaling/row-skill-stat-scaling.component';
import { skillIsUsableWithEquippedWeapons } from '@helpers/hero/skill';
import { skillDescriptionWithPreview } from '@helpers/hero/skill-preview';

// Headless: renders only an `ng-template` and exposes it via `template()`,
// for callers to hand to `[tp]` on whatever icon markup they render
// themselves (e.g. `[tp]="preview.template()"`).
@Component({
  selector: 'app-tooltip-skill-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RowSkillStatScalingComponent, IconItemPreviewComponent],
  templateUrl: './tooltip-skill-preview.component.html',
  styleUrl: './tooltip-skill-preview.component.scss',
})
export class TooltipSkillPreviewComponent {
  public display = input.required<EquipmentSkillContent>();
  public displayCombatant = input.required<Combatant>();
  public displayCharacterWeaponTypes = input<EquipmentItemType[]>([]);

  public template = viewChild.required<TemplateRef<unknown>>('tooltipContent');

  public skillDescription = computed(() =>
    skillDescriptionWithPreview(this.displayCombatant(), this.display()),
  );
  public skillUsable = computed(() =>
    skillIsUsableWithEquippedWeapons(
      this.display(),
      this.displayCharacterWeaponTypes(),
    ),
  );
}
