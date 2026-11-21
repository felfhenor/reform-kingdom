import { FFStepperDirective } from '@ff/controls/ff-stepper.directive';
import { FFSelectDirective } from '@ff/controls/ff-select.directive';
import type { CdkDragDrop } from '@angular/cdk/drag-drop';
import { DragDropModule } from '@angular/cdk/drag-drop';
import type { AnimationCallbackEvent } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { IconComponent } from '@components/icon/icon.component';
import { IconElementChargeComponent } from '@components/icon-element-charge/icon-element-charge.component';
import { IconJobComponent } from '@components/icon-job/icon-job.component';
import { RowCombatOrderClauseComponent } from '@components/row-combat-order-clause/row-combat-order-clause.component';
import { ListReflowDirective } from '@directives/list-reflow.directive';
import { ListReflowDragDirective } from '@directives/list-reflow-drag.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { COMBAT_ORDER_ALWAYS_RANDOM_CLAUSE } from '@helpers/combat/combat-order';
import { isCombatOrderTargetModeAllowedForCondition } from '@helpers/combat/combat-order-target-mode';
import {
  COMBAT_ELEMENT_CHARGES_PER_ELEMENT,
  COMBAT_ORDER_ROW_CAP,
} from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import { characterSkills } from '@helpers/hero/job';
import { characterSkillPreviewContext } from '@helpers/hero/skill-modifier.ui';
import type {
  Character,
  CharacterId,
  CombatantTargettingType,
  CombatOrderAction,
  CombatOrderClause,
  CombatOrderClauseId,
  CombatOrderComparator,
  CombatOrderCondition,
  CombatOrderHealthDirection,
  EquipmentSkillContent,
  GameElement,
  JobContent,
} from '@interfaces';
import { GameElementOrder } from '@interfaces';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { AnimationService } from '@services/animation.service';
import { sortBy, uniq } from 'es-toolkit/compat';

type SelectOption<T> = { value: T; label: string };
type FamilyOption = SelectOption<string> & { sprite: string };
type HeroOption = {
  id: CharacterId;
  name: string;
  level: number;
  job?: JobContent;
};

const CONDITION_TYPE_OPTIONS: SelectOption<CombatOrderCondition['type']>[] = [
  { value: 'Always', label: 'Always' },
  { value: 'SelfHealthPercent', label: 'My Health %' },
  { value: 'SelfEnergyPercent', label: 'My Energy %' },
  { value: 'AllyCountHealthPercent', label: 'Ally Count vs Health %' },
  { value: 'EnemyCount', label: 'Enemy Count' },
  { value: 'EnemyCountHealthPercent', label: 'Enemy Count vs Health %' },
  { value: 'SpecificHeroHealthPercent', label: 'Specific Hero Health %' },
  { value: 'SelfHasNoSummon', label: 'I Have No Summon' },
  { value: 'ElementCount', label: 'Element Charges' },
];

const COMPARATOR_OPTIONS: SelectOption<CombatOrderComparator>[] = [
  { value: 'LessThan', label: '<' },
  { value: 'LessThanOrEqual', label: '<=' },
  { value: 'Equal', label: '=' },
  { value: 'GreaterThanOrEqual', label: '>=' },
  { value: 'GreaterThan', label: '>' },
];

const HEALTH_DIRECTION_OPTIONS: SelectOption<CombatOrderHealthDirection>[] = [
  { value: 'Below', label: 'below' },
  { value: 'Above', label: 'above' },
];

const ALL_TARGET_MODE_OPTIONS: SelectOption<CombatantTargettingType | ''>[] = [
  { value: '', label: "Skill's default targeting" },
  { value: 'Random', label: 'Random' },
  { value: 'Strongest', label: 'Strongest (Highest HP)' },
  { value: 'Weakest', label: 'Weakest (Lowest HP)' },
  { value: 'Self', label: 'Self' },
  { value: 'SpecificHero', label: 'Specific Hero' },
  { value: 'MatchingAllies', label: 'Matching Allies' },
  { value: 'MatchingEnemies', label: 'Matching Enemies' },
];

const ELEMENT_OPTIONS: SelectOption<GameElement>[] = GameElementOrder.map(
  (element) => ({ value: element, label: element }),
);

const DEFAULT_DRAFT_COMPARATOR: CombatOrderComparator = 'LessThan';
const DEFAULT_DRAFT_HEALTH_DIRECTION: CombatOrderHealthDirection = 'Below';

@Component({
  selector: 'app-panel-hero-combat-orders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-4' },
  imports: [
    FFStepperDirective,
    FFSelectDirective,
    BlankSlateComponent,
    ListReflowDirective,
    ListReflowDragDirective,
    IconComponent,
    RowCombatOrderClauseComponent,
    DragDropModule,
    FormsModule,
    NgSelectComponent,
    NgOptionTemplateDirective,
    NgLabelTemplateDirective,
    AtlasImageComponent,
    IconJobComponent,
    IconElementChargeComponent,
    SFXDirective,
  ],
  templateUrl: './panel-hero-combat-orders.component.html',
})
export class PanelHeroCombatOrdersComponent {
  private anim = inject(AnimationService);

  public character = input.required<Character>();
  public party = input.required<Character[]>();
  public clauses = input.required<CombatOrderClause[]>();

  public add = output<{
    condition: CombatOrderCondition;
    action: CombatOrderAction;
  }>();
  public update = output<{
    clauseId: CombatOrderClauseId;
    condition: CombatOrderCondition;
    action: CombatOrderAction;
  }>();
  public remove = output<CombatOrderClauseId>();
  public reorder = output<{ fromIndex: number; toIndex: number }>();
  public toggleEnabled = output<{
    clauseId: CombatOrderClauseId;
    enabled: boolean;
  }>();

  constructor() {
    // A draft or edit belongs to one hero's clause list, so drop it on hero switch.
    effect(() => {
      this.characterId();
      untracked(() => this.cancelEditClause());
    });
  }

  private characterId = computed(() => this.character().id);

  public readonly rowCap = COMBAT_ORDER_ROW_CAP;
  public readonly conditionTypeOptions = CONDITION_TYPE_OPTIONS;
  public readonly comparatorOptions = COMPARATOR_OPTIONS;
  public readonly healthDirectionOptions = HEALTH_DIRECTION_OPTIONS;
  public readonly elementOptions = ELEMENT_OPTIONS;
  public readonly maxElementCharges = COMBAT_ELEMENT_CHARGES_PER_ELEMENT;
  public readonly alwaysRandomClause = COMBAT_ORDER_ALWAYS_RANDOM_CLAUSE;

  // Carries each hero's job so the picker can show a portrait + "Lv. X ClassName".
  public heroOptions = computed<HeroOption[]>(() =>
    this.party().map((character) => ({
      id: character.id,
      name: character.name,
      level: character.level,
      job: getEntry<JobContent>(character.jobId),
    })),
  );

  public skillContext = computed(() =>
    characterSkillPreviewContext(this.character()),
  );

  public job = computed(() => getEntry<JobContent>(this.character().jobId));

  public atRowCap = computed(() => this.clauses().length >= this.rowCap);

  public heroSkills = computed<EquipmentSkillContent[]>(() =>
    characterSkills(this.character()),
  );

  // One option per known family, carrying a representative skill's sprite
  // (the family's currently-resolved skill) so the picker can show an icon.
  public familyOptions = computed<FamilyOption[]>(() => {
    const skills = this.heroSkills();
    const families = sortBy(uniq(skills.map((skill) => skill.family)));

    return families.map((family) => ({
      value: family,
      label: family,
      sprite: skills.find((skill) => skill.family === family)?.sprite ?? '',
    }));
  });

  public editingClauseId = signal<CombatOrderClauseId | undefined>(undefined);
  public isEditing = computed(() => !!this.editingClauseId());

  public draftConditionType = signal<CombatOrderCondition['type']>('Always');
  public draftComparator = signal<CombatOrderComparator>(
    DEFAULT_DRAFT_COMPARATOR,
  );
  public draftValue = signal<number>(50);
  public draftHealthDirection = signal<CombatOrderHealthDirection>(
    DEFAULT_DRAFT_HEALTH_DIRECTION,
  );
  public draftHealthPercent = signal<number>(50);
  public draftCount = signal<number>(1);
  public draftElement = signal<GameElement>('Fire');
  public draftConditionCharacterId = signal<CharacterId | undefined>(undefined);
  public draftFamily = signal<string | undefined>(undefined);
  public draftTargetMode = signal<CombatantTargettingType | undefined>(
    undefined,
  );
  public draftTargetCharacterId = signal<CharacterId | undefined>(undefined);

  public draftHealthCountSide = computed<'allies' | 'enemies' | undefined>(
    () => {
      switch (this.draftConditionType()) {
        case 'AllyCountHealthPercent':
          return 'allies';
        case 'EnemyCountHealthPercent':
          return 'enemies';
        default:
          return undefined;
      }
    },
  );

  public targetModeOptions = computed<
    SelectOption<CombatantTargettingType | ''>[]
  >(() => {
    const conditionType = this.draftConditionType();
    return sortBy(
      ALL_TARGET_MODE_OPTIONS.filter((o) =>
        isCombatOrderTargetModeAllowedForCondition(
          o.value ? o.value : undefined,
          conditionType,
        ),
      ),
      (t) => t.label,
    );
  });

  public draftCondition = computed<CombatOrderCondition | undefined>(() => {
    const comparator = this.draftComparator();
    const type = this.draftConditionType();

    switch (type) {
      case 'Always':
        return { type: 'Always' };
      case 'SelfHasNoSummon':
        return { type: 'SelfHasNoSummon' };
      case 'SelfHealthPercent':
        return {
          type: 'SelfHealthPercent',
          comparator,
          value: this.draftValue(),
        };
      case 'SelfEnergyPercent':
        return {
          type: 'SelfEnergyPercent',
          comparator,
          value: this.draftValue(),
        };
      case 'AllyCountHealthPercent':
      case 'EnemyCountHealthPercent':
        return {
          type,
          healthDirection: this.draftHealthDirection(),
          healthPercent: this.draftHealthPercent(),
          comparator,
          count: this.draftCount(),
        };
      case 'EnemyCount':
        return { type: 'EnemyCount', comparator, count: this.draftCount() };
      case 'ElementCount':
        return {
          type: 'ElementCount',
          element: this.draftElement(),
          comparator,
          count: this.draftCount(),
        };
      case 'SpecificHeroHealthPercent': {
        const characterId = this.draftConditionCharacterId();
        if (!characterId) return undefined;
        return {
          type: 'SpecificHeroHealthPercent',
          characterId,
          comparator,
          value: this.draftValue(),
        };
      }
    }
  });

  public draftAction = computed<CombatOrderAction | undefined>(() => {
    const family = this.draftFamily();
    if (!family) return undefined;

    const targetMode = this.draftTargetMode();
    if (targetMode === 'SpecificHero' && !this.draftTargetCharacterId()) {
      return undefined;
    }

    return {
      type: 'CastSkillFamily',
      family,
      targetMode,
      targetCharacterId:
        targetMode === 'SpecificHero'
          ? this.draftTargetCharacterId()
          : undefined,
    };
  });

  public canSubmit = computed(() => {
    if (this.atRowCap() && !this.isEditing()) return false;
    return !!this.draftCondition() && !!this.draftAction();
  });

  public setDraftConditionType(
    option: SelectOption<CombatOrderCondition['type']> | null,
  ): void {
    const next = option?.value ?? 'Always';
    this.draftConditionType.set(next);

    if (next === 'ElementCount') {
      this.draftComparator.set('GreaterThanOrEqual');
      this.draftCount.set(this.maxElementCharges);
    }

    // Clear a stale Matching* selection rather than saving a mismatched clause.
    if (
      !isCombatOrderTargetModeAllowedForCondition(this.draftTargetMode(), next)
    ) {
      this.draftTargetMode.set(undefined);
    }
  }

  public setDraftComparator(
    option: SelectOption<CombatOrderComparator> | null,
  ): void {
    this.draftComparator.set(option?.value ?? DEFAULT_DRAFT_COMPARATOR);
  }

  public setDraftHealthDirection(
    option: SelectOption<CombatOrderHealthDirection> | null,
  ): void {
    this.draftHealthDirection.set(
      option?.value ?? DEFAULT_DRAFT_HEALTH_DIRECTION,
    );
  }

  public setDraftElement(option: SelectOption<GameElement> | null): void {
    this.draftElement.set(option?.value ?? 'Fire');
  }

  public setDraftFamily(option: SelectOption<string> | null): void {
    this.draftFamily.set(option?.value);
  }

  public setDraftTargetMode(
    option: SelectOption<CombatantTargettingType | ''> | null,
  ): void {
    const next = option?.value ? option.value : undefined;
    this.draftTargetMode.set(next);

    if (next !== 'SpecificHero') {
      this.draftTargetCharacterId.set(undefined);
    }
  }

  public setDraftConditionCharacterId(hero: HeroOption | null): void {
    this.draftConditionCharacterId.set(hero?.id);
  }

  public setDraftTargetCharacterId(hero: HeroOption | null): void {
    this.draftTargetCharacterId.set(hero?.id);
  }

  public toggleClauseEnabled(clause: CombatOrderClause): void {
    this.toggleEnabled.emit({ clauseId: clause.id, enabled: !clause.enabled });
  }

  public removeClause(clauseId: CombatOrderClauseId): void {
    if (this.editingClauseId() === clauseId) this.cancelEditClause();
    this.remove.emit(clauseId);
  }

  public onDrop(event: CdkDragDrop<CombatOrderClause[]>): void {
    this.reorder.emit({
      fromIndex: event.previousIndex,
      toIndex: event.currentIndex,
    });
  }

  public onClauseLeave(event: AnimationCallbackEvent): void {
    this.anim
      .fadeOut(event.target)
      .then(() => event.animationComplete())
      .catch(() => event.animationComplete());
  }

  public startEditClause(clause: CombatOrderClause): void {
    if (clause.action.type !== 'CastSkillFamily') return;

    this.editingClauseId.set(clause.id);
    this.draftFamily.set(clause.action.family);
    this.setDraftFromCondition(clause.condition);

    const targetMode = isCombatOrderTargetModeAllowedForCondition(
      clause.action.targetMode,
      clause.condition.type,
    )
      ? clause.action.targetMode
      : undefined;
    this.draftTargetMode.set(targetMode);
    this.draftTargetCharacterId.set(
      targetMode === 'SpecificHero'
        ? clause.action.targetCharacterId
        : undefined,
    );
  }

  private setDraftFromCondition(condition: CombatOrderCondition): void {
    this.draftConditionType.set(condition.type);

    if (
      condition.type === 'SelfHealthPercent' ||
      condition.type === 'SelfEnergyPercent'
    ) {
      this.draftComparator.set(condition.comparator);
      this.draftValue.set(condition.value);
    } else if (
      condition.type === 'AllyCountHealthPercent' ||
      condition.type === 'EnemyCountHealthPercent'
    ) {
      this.draftHealthDirection.set(condition.healthDirection);
      this.draftComparator.set(condition.comparator);
      this.draftHealthPercent.set(condition.healthPercent);
      this.draftCount.set(condition.count);
    } else if (condition.type === 'EnemyCount') {
      this.draftComparator.set(condition.comparator);
      this.draftCount.set(condition.count);
    } else if (condition.type === 'ElementCount') {
      this.draftElement.set(condition.element);
      this.draftComparator.set(condition.comparator);
      this.draftCount.set(condition.count);
    } else if (condition.type === 'SpecificHeroHealthPercent') {
      this.draftConditionCharacterId.set(condition.characterId);
      this.draftComparator.set(condition.comparator);
      this.draftValue.set(condition.value);
    }
  }

  public cancelEditClause(): void {
    this.editingClauseId.set(undefined);
    this.draftConditionType.set('Always');
    this.draftComparator.set(DEFAULT_DRAFT_COMPARATOR);
    this.draftValue.set(50);
    this.draftHealthDirection.set(DEFAULT_DRAFT_HEALTH_DIRECTION);
    this.draftHealthPercent.set(50);
    this.draftCount.set(1);
    this.draftElement.set('Fire');
    this.draftConditionCharacterId.set(undefined);
    this.draftFamily.set(undefined);
    this.draftTargetMode.set(undefined);
    this.draftTargetCharacterId.set(undefined);
  }

  public submitClause(): void {
    const condition = this.draftCondition();
    const action = this.draftAction();
    if (!this.job() || !condition || !action || !this.canSubmit()) return;

    const clauseId = this.editingClauseId();
    if (clauseId) {
      this.update.emit({ clauseId, condition, action });
    } else {
      this.add.emit({ condition, action });
    }

    this.cancelEditClause();
  }
}
