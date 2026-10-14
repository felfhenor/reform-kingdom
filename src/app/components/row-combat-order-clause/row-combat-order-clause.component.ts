import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  untracked,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { IconComponent } from '@components/icon/icon.component';
import { SFXDirective } from '@directives/sfx.directive';
import { combatOrderClauseSummary } from '@helpers/combat/combat-order.ui';
import {
  isCombatOrderFamilyEquipmentOnly,
  isCombatOrderFamilyKnown,
  isCombatOrderFamilyUsable,
} from '@helpers/combat/combat-order-evaluation.ui';
import { isCombatOrderTargetModeUsable } from '@helpers/combat/combat-order-target-mode';
import { defaultEquipment } from '@helpers/defaults';
import { characterCombatSkills, characterSkills } from '@helpers/hero/job';
import { equippedItemTypes } from '@helpers/item/equipment';
import type { Character, CombatOrderClause } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import { AnimationService } from '@services/animation.service';

@Component({
  selector: 'app-row-combat-order-clause',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center gap-2 flex-1 min-w-0' },
  imports: [AtlasImageComponent, IconComponent, TippyDirective, SFXDirective],
  templateUrl: './row-combat-order-clause.component.html',
})
export class RowCombatOrderClauseComponent {
  private anim = inject(AnimationService);
  private el = inject(ElementRef<HTMLElement>);
  private hasInitialized = false;

  public clause = input.required<CombatOrderClause>();
  public character = input.required<Character>();

  constructor() {
    // Same clause id, new params - combatOrderClauseUpdate replaces the clause object in
    // place, so this only fires on a real edit, not on the row's initial mount/add.
    effect(() => {
      this.clause();
      untracked(() => {
        if (!this.hasInitialized) {
          this.hasInitialized = true;
          return;
        }
        this.anim.pulse(this.el.nativeElement);
      });
    });
  }

  // Used for the mandatory trailing "always random skill" row, which reads
  // like any other row but isn't a real stored clause - no toggle/edit/remove.
  public readOnly = input<boolean>(false);

  public toggleEnabled = output<void>();
  public remove = output<void>();
  public edit = output<void>();

  public summary = computed(() => combatOrderClauseSummary(this.clause()));

  // RandomSkill has no family, so there's nothing to resolve or warn about.
  private family = computed(() => {
    const action = this.clause().action;
    return action.type === 'CastSkillFamily' ? action.family : undefined;
  });

  private heroSkills = computed(() => characterSkills(this.character()));

  public icon = computed(() =>
    this.heroSkills().find((skill) => skill.family === this.family()),
  );

  public isFamilyKnown = computed(() => {
    const family = this.family();
    return !family || isCombatOrderFamilyKnown(family, this.heroSkills());
  });

  // Burst skills only count as usable while chosen.
  public isFamilyUsable = computed(() => {
    const family = this.family();
    const character = this.character();
    return (
      !family ||
      isCombatOrderFamilyUsable(
        family,
        characterCombatSkills(character),
        equippedItemTypes(character.equipment),
      )
    );
  });

  public isFamilyEquipmentOnly = computed(() => {
    const family = this.family();
    if (!family) return false;

    const jobOnlySkills = characterSkills({
      ...this.character(),
      equipment: defaultEquipment(),
    });
    return isCombatOrderFamilyEquipmentOnly(family, jobOnlySkills);
  });

  public isTargetModeUsable = computed(() => {
    const action = this.clause().action;
    return (
      action.type !== 'CastSkillFamily' ||
      isCombatOrderTargetModeUsable(
        action.family,
        this.heroSkills(),
        action.targetMode,
      )
    );
  });
}
