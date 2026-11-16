import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { ModalComponent } from '@components/modal/modal.component';
import { PanelHeroBurstSkillsComponent } from '@components/panel-hero-burst-skills/panel-hero-burst-skills.component';
import { SFXDirective } from '@directives/sfx.directive';
import { heroBurstSkillsModalCharacterId } from '@helpers/engine/ui';
import { burstSkillSet, burstSkillUnset } from '@helpers/hero/burst-skill.ui';
import { characterChosenBurstSkills } from '@helpers/hero/job';
import { worldPartyState } from '@helpers/state-game';
import type { Character, EquipmentSkillContent } from '@interfaces';

@Component({
  selector: 'app-modal-hero-burst-skills',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BlankSlateComponent,
    ModalComponent,
    PanelHeroBurstSkillsComponent,
    SFXDirective,
  ],
  templateUrl: './modal-hero-burst-skills.component.html',
})
export class ModalHeroBurstSkillsComponent {
  public character = computed(() =>
    worldPartyState().find((c) => c.id === heroBurstSkillsModalCharacterId()),
  );

  public chosenId = computed(() => {
    const character = this.character();
    return character ? characterChosenBurstSkills(character)[0]?.id : undefined;
  });

  public choose(character: Character, skill: EquipmentSkillContent): void {
    burstSkillSet(character.id, character.jobId, skill);
  }

  public unset(): void {
    const character = this.character();
    if (!character) return;

    burstSkillUnset(character.id, character.jobId);
  }
}
