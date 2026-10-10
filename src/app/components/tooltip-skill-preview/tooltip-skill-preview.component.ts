import { DecimalPipe } from '@angular/common';
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
import { RowSkillTechniqueComponent } from '@components/row-skill-technique/row-skill-technique.component';
import { RowElementChargesComponent } from '@components/row-element-charges/row-element-charges.component';
import {
  skillCooldown,
  skillElementCosts,
  skillHasElementCosts,
  skillIsSpecial,
  skillIsUsableWithEquippedWeapons,
} from '@helpers/hero/skill';
import { PluralizePipe } from '@pipes/pluralize.pipe';
import {
  skillDescriptionWithPreview,
  skillTechniquePreviews,
} from '@helpers/hero/skill-preview';

// Headless: renders only an `ng-template` and exposes it via `template()`,
// for callers to hand to `[tp]` on whatever icon markup they render
// themselves (e.g. `[tp]="preview.template()"`).
@Component({
  selector: 'app-tooltip-skill-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    PluralizePipe,
    RowSkillTechniqueComponent,
    IconItemPreviewComponent,
    RowElementChargesComponent,
  ],
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
  public skillTechniques = computed(() =>
    skillTechniquePreviews(this.displayCombatant(), this.display()),
  );
  public isSpecial = computed(() => skillIsSpecial(this.display()));
  public cooldown = computed(() => skillCooldown(this.display()));
  public costs = computed(() =>
    skillHasElementCosts(this.display())
      ? skillElementCosts(this.display())
      : undefined,
  );

  public skillUsable = computed(() =>
    skillIsUsableWithEquippedWeapons(
      this.display(),
      this.displayCharacterWeaponTypes(),
    ),
  );
}
