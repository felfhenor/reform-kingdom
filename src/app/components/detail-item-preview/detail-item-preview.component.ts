import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { DetailCollectibleEffectsComponent } from '@components/detail-collectible-effects/detail-collectible-effects.component';
import { RowGatherYieldBonusesComponent } from '@components/row-gather-yield-bonuses/row-gather-yield-bonuses.component';
import { RowSkillStatBonusesComponent } from '@components/row-skill-stat-bonuses/row-skill-stat-bonuses.component';
import { RowStatSummaryComponent } from '@components/row-stat-summary/row-stat-summary.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { SlotRarityOutlineComponent } from '@components/slot-rarity-outline/slot-rarity-outline.component';
import {
  type CombatStatBlock,
  type ElementBlock,
  type ItemPreviewDisplay,
  type MonsterType,
  type StatBlock,
  type StatusEffectBlock,
} from '@interfaces';

// Single item's preview body, reused by the headless tooltip and the equip-picker's two-column comparison.
@Component({
  selector: 'app-detail-item-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SlotRarityOutlineComponent,
    RowStatSummaryComponent,
    SlotIconBlankComponent,
    AtlasImageComponent,
    RowGatherYieldBonusesComponent,
    RowSkillStatBonusesComponent,
    DetailCollectibleEffectsComponent,
  ],
  templateUrl: './detail-item-preview.component.html',
})
export class DetailItemPreviewComponent {
  public display = input.required<ItemPreviewDisplay>();
  // Extra flat bonus (e.g. infusions), shown as its own row - unset for non-equipment.
  public bonusStats = input<StatBlock>();
  public bonusResistances = input<StatusEffectBlock>();
  public bonusCombatStats = input<CombatStatBlock>();
  public bonusMonsterTypeDamage = input<Record<MonsterType, number>>();

  // When set, stat/resistance/combat-stat rows show a colored delta badge
  // against this baseline (equip-picker's two-column comparison).
  public comparisonStats = input<StatBlock>();
  public comparisonResistances = input<StatusEffectBlock>();
  public comparisonCombatStats = input<CombatStatBlock>();
  public comparisonMonsterTypeDamage = input<Record<MonsterType, number>>();
  public comparisonElementalResistances = input<ElementBlock>();
  public comparisonElementalBoons = input<ElementBlock>();

  public showEquippableBy = input<boolean>(true);
  public showDescription = input<boolean>(true);
}
