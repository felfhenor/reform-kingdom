import { DecimalPipe } from '@angular/common';
import type { AnimationCallbackEvent } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { BarProgressComponent } from '@components/bar-progress/bar-progress.component';
import { TextNumberTweenComponent } from '@components/text-number-tween/text-number-tween.component';
import { ButtonHeroCombatOrdersComponent } from '@components/button-hero-combat-orders/button-hero-combat-orders.component';
import { ButtonHeroTeachingsComponent } from '@components/button-hero-teachings/button-hero-teachings.component';
import { IconComponent } from '@components/icon/icon.component';
import { IconJobComponent } from '@components/icon-job/icon-job.component';
import { LabelJobComponent } from '@components/label-job/label-job.component';
import { ModalHeroCombatOrdersComponent } from '@components/modal-hero-combat-orders/modal-hero-combat-orders.component';
import { ModalHeroBurstSkillsComponent } from '@components/modal-hero-burst-skills/modal-hero-burst-skills.component';
import { ModalHeroTeachingsComponent } from '@components/modal-hero-teachings/modal-hero-teachings.component';
import { PanelHeroEquipmentEquipmentComponent } from '@components/panel-hero-equipment-equipment/panel-hero-equipment-equipment.component';
import { PanelHeroEquipmentSkillsComponent } from '@components/panel-hero-equipment-skills/panel-hero-equipment-skills.component';
import { PanelHeroEquipmentStatsComponent } from '@components/panel-hero-equipment-stats/panel-hero-equipment-stats.component';
import { SlotButtonContainerComponent } from '@components/slot-button-container/slot-button-container.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { HideUntilLevelDirective } from '@directives/hide-until-level.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { TutorialTargetDirective } from '@directives/tutorial-target.directive';
import { getEntry } from '@helpers/content/content';
import {
  heroBurstSkillsModalOpen,
  regaliaPageOpen,
  skillTreePageOpen,
} from '@helpers/engine/ui';
import { optimizeCharacterEquipment } from '@helpers/hero/character-equipment';
import { characterBurstSkillOptions } from '@helpers/hero/job';
import { characterSkillTreeAvailableSp } from '@helpers/hero/skill-tree';
import { demoteHero, promoteHero } from '@helpers/hero/position-swapping';
import {
  characterCurrentRegalia,
  regaliaMatchesCharacter,
  regaliaMissingItems,
} from '@helpers/hero/regalia';
import { regaliaUpdate } from '@helpers/hero/regalia.ui';
import { canModifyEquipment } from '@helpers/item/equipment';
import { armoryState, regaliasState } from '@helpers/state-game';
import { isPlayerAtKingdom, worldPartyState } from '@helpers/index';
import { isAnyTrainerDiscovered } from '@helpers/trainer/trainer';
import type { Character, JobContent } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import { AnimationService } from '@services/animation.service';
import type { SwalComponent } from '@sweetalert2/ngx-sweetalert2';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';

@Component({
  selector: 'app-panel-hero-equipment',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LabelJobComponent,
    PanelHeroEquipmentEquipmentComponent,
    PanelHeroEquipmentSkillsComponent,
    PanelHeroEquipmentStatsComponent,
    IconComponent,
    IconJobComponent,
    SlotIconBlankComponent,
    DecimalPipe,
    ButtonHeroCombatOrdersComponent,
    ButtonHeroTeachingsComponent,
    ModalHeroCombatOrdersComponent,
    ModalHeroTeachingsComponent,
    ModalHeroBurstSkillsComponent,
    BarProgressComponent,
    TextNumberTweenComponent,
    HideUntilLevelDirective,
    SlotButtonContainerComponent,
    SFXDirective,
    TutorialTargetDirective,
    TippyDirective,
    SweetAlert2Module,
  ],
  templateUrl: './panel-hero-equipment.component.html',
  styleUrl: './panel-hero-equipment.component.scss',
})
export class PanelHeroEquipmentComponent {
  private anim = inject(AnimationService);
  private regaliaUpdateSwal = viewChild<SwalComponent>('regaliaUpdateSwal');

  public isAtKingdomCurrently = computed(() => isPlayerAtKingdom());
  public teachingsUnlocked = computed(() => isAnyTrainerDiscovered());
  public canPromote = computed(
    () => worldPartyState()[0].id !== this.character().id,
  );
  public canDemote = computed(
    () => worldPartyState()[3].id !== this.character().id,
  );

  public character = input.required<Character>();

  public job = computed<JobContent | undefined>(() =>
    getEntry<JobContent>(this.character().jobId),
  );

  public equipmentModifiable = computed(() => canModifyEquipment());

  public hasBurstOptions = computed(
    () => characterBurstSkillOptions(this.character()).length > 0,
  );

  public currentRegalia = computed(() =>
    characterCurrentRegalia(regaliasState().entries, this.character()),
  );

  public regaliaMatches = computed(() => {
    const regalia = this.currentRegalia();
    return !!regalia && regaliaMatchesCharacter(regalia, this.character());
  });

  public regaliaMissingCount = computed(() => {
    const regalia = this.currentRegalia();
    return regalia
      ? regaliaMissingItems(regalia, this.character(), [
          ...regaliasState().vault,
          ...armoryState(),
        ]).length
      : 0;
  });

  promote() {
    promoteHero(this.character());
  }

  demote() {
    demoteHero(this.character());
  }

  optimize() {
    void optimizeCharacterEquipment(this.character().id);
  }

  public openBurstPicker(): void {
    heroBurstSkillsModalOpen(this.character().id);
  }

  public openRegalias(): void {
    regaliaPageOpen(this.character().id);
  }

  public freeSp = computed(() => {
    const character = this.character();
    return characterSkillTreeAvailableSp(character, character.jobId);
  });

  public openSkillTree(): void {
    skillTreePageOpen(this.character().id);
  }

  public requestRegaliaUpdate(skipConfirm = false): void {
    if (skipConfirm) {
      this.confirmRegaliaUpdate();
      return;
    }

    void this.regaliaUpdateSwal()?.fire();
  }

  public confirmRegaliaUpdate(): void {
    if (!this.regaliaMatches()) void regaliaUpdate(this.character().id);
  }

  public onEnter(event: AnimationCallbackEvent): void {
    this.anim.popIn(event.target);
  }

  public onLeave(event: AnimationCallbackEvent): void {
    this.anim
      .fadeOut(event.target)
      .then(() => event.animationComplete())
      .catch(() => event.animationComplete());
  }
}
