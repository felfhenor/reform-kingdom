import { NgTemplateOutlet } from '@angular/common';
import type { TemplateRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  viewChild,
} from '@angular/core';
import type { Combatant, EquipmentItemType, EquipmentSkill } from '@interfaces';

import { DetailSkillPreviewComponent } from '@components/detail-skill-preview/detail-skill-preview.component';
import { IconItemPreviewComponent } from '@components/icon-item-preview/icon-item-preview.component';
import { skillIsSpecial } from '@helpers/hero/skill';

// Headless: renders only an `ng-template` and exposes it via `template()`,
// for callers to hand to `[tp]` on whatever icon markup they render
// themselves (e.g. `[tp]="preview.template()"`).
@Component({
  selector: 'app-tooltip-skill-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    DetailSkillPreviewComponent,
    IconItemPreviewComponent,
  ],
  templateUrl: './tooltip-skill-preview.component.html',
  styleUrl: './tooltip-skill-preview.component.scss',
})
export class TooltipSkillPreviewComponent {
  public display = input.required<EquipmentSkill>();
  public displayCombatant = input.required<Combatant>();
  public displayCharacterWeaponTypes = input<EquipmentItemType[]>([]);
  public footer = input<TemplateRef<unknown>>();

  public template = viewChild.required<TemplateRef<unknown>>('tooltipContent');

  public isSpecial = computed(() => skillIsSpecial(this.display()));
}
