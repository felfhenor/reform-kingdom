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
import { RowBestiarySkillComponent } from '@components/row-bestiary-skill/row-bestiary-skill.component';
import { SlotCompletionRewardComponent } from '@components/slot-completion-reward/slot-completion-reward.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { IconUnknownComponent } from '@components/icon-unknown/icon-unknown.component';
import { RowItemStatsComponent } from '@components/row-item-stats/row-item-stats.component';
import { bestiaryDropQuantityLabel, bestiaryXpLabel } from '@helpers/bestiary';
import { combatantFromMonster } from '@helpers/combat-create';
import { getEntry } from '@helpers/content';
import { monsterStatsAtLevel } from '@helpers/monster';
import { skillDescriptionWithPreview } from '@helpers/skill-preview';
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
  selector: 'app-detail-bestiary-monster',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasAnimationComponent,
    RowBestiarySkillComponent,
    SlotCompletionRewardComponent,
    FormsModule,
    SlotIconBlankComponent,
    IconUnknownComponent,
    RowItemStatsComponent,
    NgSelectComponent,
  ],
  templateUrl: './detail-bestiary-monster.component.html',
  styleUrl: './detail-bestiary-monster.component.scss',
})
export class DetailBestiaryMonsterComponent {
  public entry = input.required<BestiaryEntry>();

  // Actual min/max fought, for the "Lv. X-Y" line and picker bounds - distinct from `selectedLevel`, the single level being previewed.
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
    // Resets the picker only when the monster changes, not on every `entry()` recompute (which fires more often, e.g. a live kill count).
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
      .monster.skills.map((skill) =>
        getEntry<EquipmentSkillContent>(skill.skillId),
      )
      .filter((skill): skill is EquipmentSkillContent => !!skill),
  );

  // Preview is computed at the selected level, not level 1, so it reflects what the player actually faces.
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
