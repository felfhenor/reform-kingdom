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
import { IconUnknownComponent } from '@components/icon-unknown/icon-unknown.component';
import { RowBestiarySkillComponent } from '@components/row-bestiary-skill/row-bestiary-skill.component';
import { RowStatSummaryComponent } from '@components/row-stat-summary/row-stat-summary.component';
import { SlotCompletionRewardComponent } from '@components/slot-completion-reward/slot-completion-reward.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { combatantFromMonster } from '@helpers/combat/combat-create';
import { monsterStatsAtLevel } from '@helpers/combat/monster';
import { getEntry } from '@helpers/content/content';
import {
  bestiaryDropQuantityLabel,
  bestiaryXpLabel,
} from '@helpers/kingdom/bestiary.ui';
import {
  type BestiaryEntry,
  type Combatant,
  type EncounterContent,
  type EquipmentSkillContent,
  type MonsterId,
  type StatBlock,
} from '@interfaces';

import { NgSelectComponent } from '@ng-select/ng-select';
import { maxBy, minBy, sortBy, uniq } from 'es-toolkit/compat';

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
    RowStatSummaryComponent,
    NgSelectComponent,
  ],
  templateUrl: './detail-bestiary-monster.component.html',
  styleUrl: './detail-bestiary-monster.component.scss',
})
export class DetailBestiaryMonsterComponent {
  public entry = input.required<BestiaryEntry>();

  public selectedLevel = signal(1);

  private lastMonsterId?: MonsterId;

  public levelMin = computed(
    () => minBy(this.levelOptions(), 'value')?.value ?? 1,
  );
  public levelMax = computed(
    () => maxBy(this.levelOptions(), 'value')?.value ?? 1,
  );

  public filteredSourceNodes = computed(() => {
    return this.entry()
      .sourceNodeNames.map((e) => getEntry<EncounterContent>(e)!)
      .filter(Boolean);
  });

  public levelOptions = computed<LevelOption[]>(() => {
    return sortBy(
      uniq(
        this.filteredSourceNodes().flatMap((node) =>
          Array(node.levelRange.max - node.levelRange.min)
            .fill(0)
            .map((_, i) => i + node.levelRange.min),
        ),
      ),
    ).map((x) => ({ value: x, label: `Lv. ${x}` }));
  });

  public sourceNodesAtLevel = computed(() => {
    return this.filteredSourceNodes()

      .filter((node) => {
        const curLevel = this.selectedLevel();

        return (
          curLevel >= node.levelRange.min && curLevel <= node.levelRange.max
        );
      });
  });

  public nodeNameString = computed(() =>
    this.sourceNodesAtLevel()
      .map((e) => e.name)
      .join(', '),
  );

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

  public combatantAtSelectedLevel = computed<Combatant>(() =>
    combatantFromMonster(this.entry().monster, this.selectedLevel(), 0),
  );

  public filteredDrops = computed(() =>
    this.entry()
      .monster.drops.filter(
        (d) =>
          d.minLevel <= this.selectedLevel() &&
          d.maxLevel >= this.selectedLevel(),
      )
      .map((d) => ({
        ...d,
        label: bestiaryDropQuantityLabel(d, this.selectedLevel()),
      })),
  );

  constructor() {
    effect(() => {
      const entry = this.entry();
      if (entry.monster.id === this.lastMonsterId) return;

      this.lastMonsterId = entry.monster.id;
      this.selectedLevel.set(this.levelOptions()[0].value);
    });
  }
}
