import type { AnimationCallbackEvent } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DetailMonsterSummaryComponent } from '@components/detail-monster-summary/detail-monster-summary.component';
import { RowBestiarySkillComponent } from '@components/row-bestiary-skill/row-bestiary-skill.component';
import { RowStatSummaryComponent } from '@components/row-stat-summary/row-stat-summary.component';
import { SlotCompletionRewardComponent } from '@components/slot-completion-reward/slot-completion-reward.component';
import { combatantFromMonster } from '@helpers/combat/combat-create';
import {
  monsterSkillsAtLevel,
  monsterStatsAtLevel,
} from '@helpers/combat/monster';
import { getEntry } from '@helpers/content/content';
import {
  bestiaryDropQuantityLabel,
  bestiaryEntryLevels,
} from '@helpers/kingdom/bestiary.ui';
import {
  type BestiaryEntry,
  type Combatant,
  type EquipmentSkillContent,
  type MonsterId,
  type StatBlock,
} from '@interfaces';

import { NgSelectComponent } from '@ng-select/ng-select';
import { AnimationService } from '@services/animation.service';

type LevelOption = { value: number; label: string };

@Component({
  selector: 'app-detail-bestiary-monster',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DetailMonsterSummaryComponent,
    RowBestiarySkillComponent,
    SlotCompletionRewardComponent,
    FormsModule,
    RowStatSummaryComponent,
    NgSelectComponent,
  ],
  templateUrl: './detail-bestiary-monster.component.html',
  styleUrl: './detail-bestiary-monster.component.scss',
})
export class DetailBestiaryMonsterComponent {
  private anim = inject(AnimationService);

  public entry = input.required<BestiaryEntry>();

  public selectedLevel = signal(1);

  private lastMonsterId?: MonsterId;

  public levelOptions = computed<LevelOption[]>(() =>
    bestiaryEntryLevels(this.entry()).map((value) => ({
      value,
      label: `Lv. ${value}`,
    })),
  );

  public stats = computed<StatBlock>(() =>
    monsterStatsAtLevel(this.entry().monster, this.selectedLevel()),
  );

  public skills = computed<EquipmentSkillContent[]>(() =>
    monsterSkillsAtLevel(this.entry().monster, this.selectedLevel())
      .map((skill) => getEntry<EquipmentSkillContent>(skill.skillId))
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

  public onSkillEnter(event: AnimationCallbackEvent, index: number): void {
    this.anim.staggerIn(event.target, index);
  }

  constructor() {
    effect(() => {
      const entry = this.entry();
      if (entry.monster.id === this.lastMonsterId) return;

      this.lastMonsterId = entry.monster.id;
      this.selectedLevel.set(this.levelOptions()[0]?.value ?? 1);
    });
  }
}
