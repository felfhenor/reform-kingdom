import type { TemplateRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  viewChild,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { IconItemPreviewComponent } from '@components/icon-item-preview/icon-item-preview.component';
import { RowStatSummaryComponent } from '@components/row-stat-summary/row-stat-summary.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { equipmentItemGrantedSkills } from '@helpers/item/equipment-display.ui';
import {
  type CombatStatBlock,
  type EquipmentSkillContent,
  type ItemPreviewDisplay,
  type StatBlock,
  type StatusEffectBlock,
} from '@interfaces';

// Headless: renders only an `ng-template` and exposes it via `template()`,
// for callers to hand to `[tp]` on whatever icon markup they render
// themselves (e.g. `[tp]="preview.template()"`).
@Component({
  selector: 'app-tooltip-item-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconItemPreviewComponent,
    RowStatSummaryComponent,
    SlotIconBlankComponent,
    AtlasImageComponent,
  ],
  templateUrl: './tooltip-item-preview.component.html',
  styleUrl: './tooltip-item-preview.component.scss',
})
export class TooltipItemPreviewComponent {
  public display = input<ItemPreviewDisplay>();
  // Extra flat bonus (e.g. from infusions) shown as its own set of rows in
  // the stats block. Only ever meaningful for equipment, so most callers
  // leave this unset.
  public bonusStats = input<StatBlock>();
  public bonusResistances = input<StatusEffectBlock>();
  public bonusCombatStats = input<CombatStatBlock>();

  public showEquippableBy = input<boolean>(true);
  public showDescription = input<boolean>(true);

  public template = viewChild.required<TemplateRef<unknown>>('tooltipContent');

  public grantedSkills = computed<EquipmentSkillContent[]>(() =>
    equipmentItemGrantedSkills(this.equipmentItem(), this.equipment()),
  );
}
