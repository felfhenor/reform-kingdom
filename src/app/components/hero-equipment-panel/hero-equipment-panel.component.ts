import { ScrollingModule } from '@angular/cdk/scrolling';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { EquipmentItemCardComponent } from '@components/equipment-item-card/equipment-item-card.component';
import { EquipmentSlotComponent } from '@components/equipment-slot/equipment-slot.component';
import { IconBlankSlotComponent } from '@components/icon-blank-slot/icon-blank-slot.component';
import { IconJobComponent } from '@components/icon-job/icon-job.component';
import {
  IconStatComponent,
  STAT_SHORTHAND,
} from '@components/icon-stat/icon-stat.component';
import {
  canEquipItem,
  characterEquipFromArmory,
  characterUnequipToArmory,
  equipmentAvailableForSlot,
  equippedItemTypes,
  getEntry,
  heroSkillsAtLevel,
  isSlotAvailableForJob,
  skillIsUsableWithEquippedWeapons,
} from '@helpers';
import type {
  BaseStat,
  Character,
  EquipmentContent,
  EquipmentId,
  EquipmentItemType,
  EquipmentSkillContent,
  EquipmentSlot,
  JobContent,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import { clamp } from 'es-toolkit/compat';

const PAPERDOLL_ROWS: EquipmentSlot[][] = [
  ['Helmet', 'Accessory'],
  ['Armor', 'Ring'],
  ['Weapon', 'Offhand'],
  ['Ammo', 'Artifact'],
];

@Component({
  selector: 'app-hero-equipment-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    EquipmentSlotComponent,
    EquipmentItemCardComponent,
    IconBlankSlotComponent,
    IconJobComponent,
    IconStatComponent,
    ScrollingModule,
    TippyDirective,
  ],
  templateUrl: './hero-equipment-panel.component.html',
  styleUrl: './hero-equipment-panel.component.scss',
})
export class HeroEquipmentPanelComponent {
  public character = input.required<Character>();

  public statKeys: BaseStat[] = [
    'Health',
    'Energy',
    'Strength',
    'Intelligence',
    'Vitality',
    'Resistance',
    'Agility',
    'Luck',
  ];
  public statShorthand = STAT_SHORTHAND;
  public paperdollRows = PAPERDOLL_ROWS;

  public selectedSlot = signal<EquipmentSlot | undefined>(undefined);

  // Only equippable-right-now gear shows up in the picker - ineligible items
  // are filtered out entirely rather than shown disabled.
  public pickerItems = computed<EquipmentContent[]>(() => {
    const slot = this.selectedSlot();
    if (!slot) return [];

    const character = this.character();
    return equipmentAvailableForSlot(slot).filter((item) =>
      canEquipItem(character, item),
    );
  });

  public selectedSlotContent = computed<EquipmentContent | undefined>(() => {
    const slot = this.selectedSlot();
    return slot ? this.equippedContentFor(slot) : undefined;
  });

  public job = computed<JobContent | undefined>(() =>
    getEntry<JobContent>(this.character().jobId),
  );

  public heroSkills = computed<EquipmentSkillContent[]>(() => {
    const job = this.job();
    if (!job) return [];

    return heroSkillsAtLevel(job, this.character().level)
      .map((skillId) => getEntry<EquipmentSkillContent>(skillId))
      .filter((skill): skill is EquipmentSkillContent => !!skill);
  });

  public equippedWeaponTypes = computed<EquipmentItemType[]>(() =>
    equippedItemTypes(this.character().equipment),
  );

  public xpPercent = computed<number>(() => {
    const xp = this.character().xp;
    return clamp((xp.current / Math.max(xp.maximum, 1)) * 100, 0, 100);
  });

  public statValue(stat: BaseStat): number {
    return Math.round(this.character().stats[stat] * 10) / 10;
  }

  public isSkillUsable(skill: EquipmentSkillContent): boolean {
    return skillIsUsableWithEquippedWeapons(skill, this.equippedWeaponTypes());
  }

  public isSlotVisible(slot: EquipmentSlot): boolean {
    return isSlotAvailableForJob(slot, this.character().jobId);
  }

  // Skips rendering a paperdoll row entirely (rather than an empty gap) when
  // none of its slots apply to this hero's class - e.g. the Ammo/Artifact
  // row for anyone who isn't a Ranger or Magician.
  public rowHasVisibleSlot(row: EquipmentSlot[]): boolean {
    return row.some((slot) => this.isSlotVisible(slot));
  }

  public equippedIdFor(slot: EquipmentSlot): EquipmentId | undefined {
    return this.character().equipment[slot]?.equipmentId;
  }

  public equippedContentFor(slot: EquipmentSlot): EquipmentContent | undefined {
    const equipmentId = this.equippedIdFor(slot);
    return equipmentId ? getEntry<EquipmentContent>(equipmentId) : undefined;
  }

  public trackByItemId(_index: number, item: EquipmentContent): EquipmentId {
    return item.id;
  }

  public selectSlot(slot: EquipmentSlot): void {
    this.selectedSlot.set(this.selectedSlot() === slot ? undefined : slot);
  }

  public equip(equipmentId: EquipmentId): void {
    if (characterEquipFromArmory(this.character().id, equipmentId)) {
      this.selectedSlot.set(undefined);
    }
  }

  public unequip(slot = this.selectedSlot()): void {
    if (!slot) return;

    if (characterUnequipToArmory(this.character().id, slot)) {
      this.selectedSlot.set(undefined);
    }
  }
}
