import type { CdkDragDrop } from '@angular/cdk/drag-drop';
import { DragDropModule } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { IconJobComponent } from '@components/icon-job/icon-job.component';
import { ModalComponent } from '@components/modal/modal.component';
import { RowCombatOrderClauseComponent } from '@components/row-combat-order-clause/row-combat-order-clause.component';
import {
  COMBAT_ORDER_ROW_CAP,
  combatOrderClauseAdd,
  combatOrderClauseRemove,
  combatOrderClauseReorder,
  combatOrderClauses,
  combatOrderClauseSetEnabled,
  combatOrderClauseUpdate,
} from '@helpers/combat-order';
import {
  isCombatOrderFamilyEquipmentOnly,
  isCombatOrderFamilyKnown,
  isCombatOrderFamilyUsable,
  isCombatOrderTargetModeUsable,
} from '@helpers/combat-order-evaluation';
import { getEntry } from '@helpers/content';
import { equippedItemTypes } from '@helpers/equipment';
import { heroSkillsAtLevel, heroSkillsWithEquipment } from '@helpers/job';
import { partyGet } from '@helpers/party';
import { combatOrdersModalCharacterId } from '@helpers/ui';
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
  EquipmentItemType,
  EquipmentSkillContent,
  JobContent,
} from '@interfaces';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { sortBy, uniq } from 'es-toolkit/compat';

type SelectOption<T> = { value: T; label: string };
type FamilyOption = SelectOption<string> & { sprite: string };
type HeroOption = {
  id: CharacterId;
  name: string;
  level: number;
  job: JobContent | undefined;
};

const CONDITION_TYPE_OPTIONS: SelectOption<CombatOrderCondition['type']>[] = [
  { value: 'Always', label: 'Always' },
  { value: 'SelfHealthPercent', label: 'My Health %' },
  { value: 'SelfEnergyPercent', label: 'My Energy %' },
  { value: 'AllyCountHealthPercent', label: 'Ally Count vs Health %' },
  { value: 'EnemyCount', label: 'Enemy Count' },
  { value: 'SpecificHeroHealthPercent', label: 'Specific Hero Health %' },
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
];

const DEFAULT_DRAFT_COMPARATOR: CombatOrderComparator = 'LessThan';
const DEFAULT_DRAFT_HEALTH_DIRECTION: CombatOrderHealthDirection = 'Below';

// The mandatory trailing fallback row - not a real stored clause, so it
// isn't in `clauses()`; rendered read-only via the same row component so it
// looks consistent with the rest of the list instead of standing out.
const ALWAYS_RANDOM_CLAUSE: CombatOrderClause = {
  id: 'always-random-fallback' as CombatOrderClauseId,
  enabled: true,
  condition: { type: 'Always' },
  action: { type: 'RandomSkill' },
};

@Component({
  selector: 'app-modal-hero-combat-orders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ModalComponent,
    RowCombatOrderClauseComponent,
    DragDropModule,
    FormsModule,
    NgSelectComponent,
    NgOptionTemplateDirective,
    NgLabelTemplateDirective,
    AtlasImageComponent,
    IconJobComponent,
  ],
  templateUrl: './modal-hero-combat-orders.component.html',
})
export class ModalHeroCombatOrdersComponent {
  public readonly rowCap = COMBAT_ORDER_ROW_CAP;
  public readonly conditionTypeOptions = CONDITION_TYPE_OPTIONS;
  public readonly comparatorOptions = COMPARATOR_OPTIONS;
  public readonly healthDirectionOptions = HEALTH_DIRECTION_OPTIONS;
  public readonly alwaysRandomClause = ALWAYS_RANDOM_CLAUSE;

  public party = computed<Character[]>(() => partyGet());

  // Carries each hero's job so the picker can show a portrait + "Lv. X ClassName".
  public heroOptions = computed<HeroOption[]>(() =>
    this.party().map((character) => ({
      id: character.id,
      name: character.name,
      level: character.level,
      job: getEntry<JobContent>(character.jobId),
    })),
  );

  public character = computed<Character | undefined>(() =>
    partyGet().find((c) => c.id === combatOrdersModalCharacterId()),
  );

  public job = computed<JobContent | undefined>(() => {
    const character = this.character();
    return character ? getEntry<JobContent>(character.jobId) : undefined;
  });

  public clauses = computed<CombatOrderClause[]>(() => {
    const character = this.character();
    const job = this.job();
    if (!character || !job) return [];
    return combatOrderClauses(character.id, job.id);
  });

  public atRowCap = computed(() => this.clauses().length >= this.rowCap);

  public heroSkills = computed<EquipmentSkillContent[]>(() => {
    const character = this.character();
    const job = this.job();
    if (!character || !job) return [];
    return heroSkillsWithEquipment(job, character.level, character.equipment);
  });

  // The job-path-only skill list (no equipment) - used to flag rows whose
  // family only exists because of currently-equipped gear.
  public jobOnlySkills = computed<EquipmentSkillContent[]>(() => {
    const character = this.character();
    const job = this.job();
    if (!character || !job) return [];

    return heroSkillsAtLevel(job, character.level)
      .map((id) => getEntry<EquipmentSkillContent>(id))
      .filter((skill): skill is EquipmentSkillContent => !!skill);
  });

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

  public equippedWeaponTypes = computed<EquipmentItemType[]>(() => {
    const character = this.character();
    return character ? equippedItemTypes(character.equipment) : [];
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
  public draftConditionCharacterId = signal<CharacterId | undefined>(undefined);
  public draftFamily = signal<string | undefined>(undefined);
  public draftTargetMode = signal<CombatantTargettingType | undefined>(
    undefined,
  );
  public draftTargetCharacterId = signal<CharacterId | undefined>(undefined);

  // "Matching Allies" only means anything for an Ally Count vs Health % condition.
  public targetModeOptions = computed<
    SelectOption<CombatantTargettingType | ''>[]
  >(() =>
    sortBy(
      this.draftConditionType() === 'AllyCountHealthPercent'
        ? ALL_TARGET_MODE_OPTIONS
        : ALL_TARGET_MODE_OPTIONS.filter((o) => o.value !== 'MatchingAllies'),
      (t) => t.label,
    ),
  );

  public draftCondition = computed<CombatOrderCondition | undefined>(() => {
    const comparator = this.draftComparator();

    switch (this.draftConditionType()) {
      case 'Always':
        return { type: 'Always' };
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
        return {
          type: 'AllyCountHealthPercent',
          healthDirection: this.draftHealthDirection(),
          healthPercent: this.draftHealthPercent(),
          comparator,
          count: this.draftCount(),
        };
      case 'EnemyCount':
        return { type: 'EnemyCount', comparator, count: this.draftCount() };
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

    // Clear a stale "Matching Allies" selection rather than saving a mismatched clause.
    if (
      next !== 'AllyCountHealthPercent' &&
      this.draftTargetMode() === 'MatchingAllies'
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

  public isFamilyKnown(clause: CombatOrderClause): boolean {
    if (clause.action.type !== 'CastSkillFamily') return true;
    return isCombatOrderFamilyKnown(clause.action.family, this.heroSkills());
  }

  public isFamilyUsable(clause: CombatOrderClause): boolean {
    if (clause.action.type !== 'CastSkillFamily') return true;
    return isCombatOrderFamilyUsable(
      clause.action.family,
      this.heroSkills(),
      this.equippedWeaponTypes(),
    );
  }

  public isFamilyEquipmentOnly(clause: CombatOrderClause): boolean {
    if (clause.action.type !== 'CastSkillFamily') return false;
    return isCombatOrderFamilyEquipmentOnly(
      clause.action.family,
      this.jobOnlySkills(),
    );
  }

  public isTargetModeUsable(clause: CombatOrderClause): boolean {
    if (clause.action.type !== 'CastSkillFamily') return true;
    return isCombatOrderTargetModeUsable(
      clause.action.family,
      this.heroSkills(),
      clause.action.targetMode,
    );
  }

  public toggleClauseEnabled(clause: CombatOrderClause): void {
    const character = this.character();
    const job = this.job();
    if (!character || !job) return;

    combatOrderClauseSetEnabled(
      character.id,
      job.id,
      clause.id,
      !clause.enabled,
    );
  }

  public removeClause(clauseId: CombatOrderClauseId): void {
    const character = this.character();
    const job = this.job();
    if (!character || !job) return;

    if (this.editingClauseId() === clauseId) this.cancelEditClause();
    combatOrderClauseRemove(character.id, job.id, clauseId);
  }

  public onDrop(event: CdkDragDrop<CombatOrderClause[]>): void {
    const character = this.character();
    const job = this.job();
    if (!character || !job) return;

    combatOrderClauseReorder(
      character.id,
      job.id,
      event.previousIndex,
      event.currentIndex,
    );
  }

  public startEditClause(clause: CombatOrderClause): void {
    if (clause.action.type !== 'CastSkillFamily') return;

    this.editingClauseId.set(clause.id);
    this.draftFamily.set(clause.action.family);
    this.setDraftFromCondition(clause.condition);

    // Drop a MatchingAllies targetMode if the loaded condition no longer matches it.
    const targetMode =
      clause.action.targetMode === 'MatchingAllies' &&
      clause.condition.type !== 'AllyCountHealthPercent'
        ? undefined
        : clause.action.targetMode;
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
    } else if (condition.type === 'AllyCountHealthPercent') {
      this.draftHealthDirection.set(condition.healthDirection);
      this.draftComparator.set(condition.comparator);
      this.draftHealthPercent.set(condition.healthPercent);
      this.draftCount.set(condition.count);
    } else if (condition.type === 'EnemyCount') {
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
    this.draftConditionCharacterId.set(undefined);
    this.draftFamily.set(undefined);
    this.draftTargetMode.set(undefined);
    this.draftTargetCharacterId.set(undefined);
  }

  public submitClause(): void {
    const character = this.character();
    const job = this.job();
    const condition = this.draftCondition();
    const action = this.draftAction();
    if (!character || !job || !condition || !action || !this.canSubmit()) {
      return;
    }

    const editingClauseId = this.editingClauseId();
    if (editingClauseId) {
      combatOrderClauseUpdate(
        character.id,
        job.id,
        editingClauseId,
        condition,
        action,
      );
    } else {
      combatOrderClauseAdd(character.id, job.id, condition, action);
    }

    this.cancelEditClause();
  }

  public resetProps(): void {
    this.cancelEditClause();
  }
}
