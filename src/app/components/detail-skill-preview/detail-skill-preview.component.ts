import { DecimalPipe, formatNumber } from '@angular/common';
import type { TemplateRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
} from '@angular/core';
import { RowElementChargesComponent } from '@components/row-element-charges/row-element-charges.component';
import { RowSkillModifierComponent } from '@components/row-skill-modifier/row-skill-modifier.component';
import { RowSkillTechniqueComponent } from '@components/row-skill-technique/row-skill-technique.component';
import {
  skillCooldown,
  skillElementCosts,
  skillHasElementCosts,
  skillIsUsableWithEquippedWeapons,
} from '@helpers/hero/skill';
import { skillModifierLines } from '@helpers/hero/skill-modifier.ui';
import {
  skillDescriptionWithPreview,
  skillTechniquePreviews,
} from '@helpers/hero/skill-preview';
import type { Combatant, EquipmentItemType, EquipmentSkill } from '@interfaces';
import { PluralizePipe } from '@pipes/pluralize.pipe';

// Single skill's preview body, reused by the headless tooltip and the skill tree detail panel.
@Component({
  selector: 'app-detail-skill-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    PluralizePipe,
    RowElementChargesComponent,
    RowSkillModifierComponent,
    RowSkillTechniqueComponent,
  ],
  templateUrl: './detail-skill-preview.component.html',
})
export class DetailSkillPreviewComponent {
  public skill = input.required<EquipmentSkill>();
  public combatant = input.required<Combatant>();
  public characterWeaponTypes = input<EquipmentItemType[]>([]);
  public skillTooltip = input<TemplateRef<unknown>>();

  private locale = inject(LOCALE_ID);

  public description = computed(() =>
    skillDescriptionWithPreview(this.combatant(), this.skill()),
  );
  public modifierLines = computed(() =>
    skillModifierLines(this.skill(), (value) =>
      formatNumber(value, this.locale),
    ),
  );
  public techniques = computed(() =>
    skillTechniquePreviews(this.combatant(), this.skill()),
  );
  public cooldown = computed(() => skillCooldown(this.skill()));
  public costs = computed(() =>
    skillHasElementCosts(this.skill())
      ? skillElementCosts(this.skill())
      : undefined,
  );
  public usable = computed(() =>
    skillIsUsableWithEquippedWeapons(this.skill(), this.characterWeaponTypes()),
  );
}
