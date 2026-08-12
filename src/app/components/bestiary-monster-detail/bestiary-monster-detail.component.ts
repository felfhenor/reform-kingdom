import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AtlasAnimationComponent } from '@components/atlas-animation/atlas-animation.component';
import { BestiarySkillRowComponent } from '@components/bestiary-skill-row/bestiary-skill-row.component';
import { CompletionRewardSlotComponent } from '@components/completion-reward-slot/completion-reward-slot.component';
import { IconBlankSlotComponent } from '@components/icon-blank-slot/icon-blank-slot.component';
import { IconUnknownComponent } from '@components/icon-unknown/icon-unknown.component';
import { ItemStatRowsComponent } from '@components/item-stat-rows/item-stat-rows.component';
import {
  bestiaryDropQuantityLabel,
  bestiaryXpLabel,
  combatantFromMonster,
  getEntry,
  monsterStatsAtLevel,
  skillDescriptionWithPreview,
} from '@helpers';
import type {
  BestiaryEntry,
  Combatant,
  DroppedReward,
  EquipmentSkillContent,
  MonsterId,
  StatBlock,
} from '@interfaces';
import { NgSelectComponent } from '@ng-select/ng-select';

type LevelOption = { value: number; label: string };

@Component({
  selector: 'app-bestiary-monster-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasAnimationComponent,
    BestiarySkillRowComponent,
    CompletionRewardSlotComponent,
    FormsModule,
    IconBlankSlotComponent,
    IconUnknownComponent,
    ItemStatRowsComponent,
    NgSelectComponent,
  ],
  templateUrl: './bestiary-monster-detail.component.html',
  styleUrl: './bestiary-monster-detail.component.scss',
})
export class BestiaryMonsterDetailComponent {
  public entry = input.required<BestiaryEntry>();

  // The actual min/max level the party has fought this monster at - the
  // "Lv. X-Y" summary line and the level picker's bounds. Distinct from
  // `selectedLevel`, which is just which single level is being previewed.
  public levelMin = computed(() => this.entry().levelRange?.min ?? 1);
  public levelMax = computed(() => this.entry().levelRange?.max ?? 1);

  public levelOptions = computed<LevelOption[]>(() => {
    const options: LevelOption[] = [];
    for (let level = this.levelMin(); level <= this.levelMax(); level++) {
      options.push({ value: level, label: `Lv. ${level}` });
    }
    return options;
  });

  public selectedLevel = signal(1);

  private lastMonsterId: MonsterId | undefined;

  constructor() {
    // Defaults (and resets) the picker to the monster's highest found level
    // whenever the *monster* changes - not on every `entry()` recompute,
    // which fires far more often (e.g. a kill count ticking up elsewhere
    // while this monster is open) and would otherwise snap a manually
    // picked level back to max.
    effect(() => {
      const entry = this.entry();
      if (entry.monster.id === this.lastMonsterId) return;

      this.lastMonsterId = entry.monster.id;
      this.selectedLevel.set(entry.levelRange?.max ?? 1);
    });
  }

  public stats = computed<StatBlock>(() =>
    monsterStatsAtLevel(this.entry().monster, this.selectedLevel()),
  );

  public xpLabel = computed(() =>
    bestiaryXpLabel(this.entry().monster, this.selectedLevel()),
  );

  public skills = computed<EquipmentSkillContent[]>(() =>
    this.entry()
      .monster.skills.map((skill) => getEntry<EquipmentSkillContent>(skill.skillId))
      .filter((skill): skill is EquipmentSkillContent => !!skill),
  );

  // A skill's `{{ value }}` preview is computed against the monster at the
  // selected level - a level 1 monster's skill would otherwise always
  // preview as weaker than what the player actually faces at higher levels.
  private combatantAtSelectedLevel = computed<Combatant>(() =>
    combatantFromMonster(this.entry().monster, this.selectedLevel(), 0),
  );

  public skillDescription(skill: EquipmentSkillContent): string {
    return skillDescriptionWithPreview(this.combatantAtSelectedLevel(), skill);
  }

  public dropQuantityLabel(reward: DroppedReward): string {
    return bestiaryDropQuantityLabel(reward, this.selectedLevel());
  }
}
